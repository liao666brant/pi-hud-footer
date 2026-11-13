// Providers usually omit live output usage while streaming. CJK text is about
// one token per character; everything else stays on the 4-character estimate.
const CHARS_PER_TOKEN = 4;
const TOKEN_RATE_WINDOW_MS = 2000;
const MIN_TOKEN_RATE_SPAN_MS = 600;
const SMOOTH_DT_MIN_MS = 50;
const SMOOTH_DT_MAX_MS = 400;
const SMOOTH_TAU_MS = 1200;

export interface AssistantRateMessage {
	usage: { output: number };
	timestamp: number;
	durationMs?: number;
}

export interface TokenRateTracker {
	readonly rate: number | undefined;
	/** Clear the current message window. The displayed rate stays until this message produces its own. */
	beginMessage(): void;
	reset(): void;
	addDelta(text: string, now?: number): void;
	finish(message: AssistantRateMessage, endedAt?: number): void;
}

interface TokenRateSample {
	timestamp: number;
	tokens: number;
}

function countsAsOneToken(codePoint: number): boolean {
	return (
		(codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
		(codePoint >= 0xac00 && codePoint <= 0xd7af) ||
		(codePoint >= 0xf900 && codePoint <= 0xfaff) ||
		(codePoint >= 0xff00 && codePoint <= 0xffef)
	);
}

export function estimateTokens(text: string): number {
	let single = 0;
	let other = 0;
	for (const char of text) {
		const codePoint = char.codePointAt(0);
		if (codePoint !== undefined && countsAsOneToken(codePoint)) single += 1;
		else other += 1;
	}
	return single + other / CHARS_PER_TOKEN;
}

function generationMs(message: AssistantRateMessage, firstDeltaAt: number | undefined, endedAt: number): number | undefined {
	const responseMs = message.durationMs ?? endedAt - message.timestamp;
	if (!Number.isFinite(responseMs) || responseMs <= 0) return undefined;
	if (firstDeltaAt === undefined) return responseMs;
	const firstTokenMs = Math.max(0, Math.min(firstDeltaAt - message.timestamp, responseMs));
	const generating = responseMs - firstTokenMs;
	if (!Number.isFinite(generating) || generating <= 0) return undefined;
	return generating;
}

function smoothRate(previous: number, previousAt: number, instant: number, now: number): number {
	const deltaMs = Math.min(Math.max(now - previousAt, SMOOTH_DT_MIN_MS), SMOOTH_DT_MAX_MS);
	const weight = 1 - Math.exp(-deltaMs / SMOOTH_TAU_MS);
	return previous + (instant - previous) * weight;
}

export function createTokenRateTracker(): TokenRateTracker {
	let samples: TokenRateSample[] = [];
	let estimatedTokens = 0;
	let firstDeltaAt: number | undefined;
	let rate: number | undefined;
	let rateUpdatedAt: number | undefined;

	function beginMessage() {
		samples = [];
		estimatedTokens = 0;
		firstDeltaAt = undefined;
		// The next valid window replaces the displayed rate instead of blending across messages.
		rateUpdatedAt = undefined;
	}

	function reset() {
		beginMessage();
		rate = undefined;
	}

	function pushSample(tokens: number, now: number) {
		samples.push({ timestamp: now, tokens });
		while (samples.length > 1 && now - samples[0].timestamp > TOKEN_RATE_WINDOW_MS) {
			samples.shift();
		}
		const span = now - samples[0].timestamp;
		if (span < MIN_TOKEN_RATE_SPAN_MS) return;
		const instant = (tokens - samples[0].tokens) / (span / 1000);
		if (!Number.isFinite(instant) || instant < 0) return;
		rate = rate === undefined || rateUpdatedAt === undefined ? instant : smoothRate(rate, rateUpdatedAt, instant, now);
		rateUpdatedAt = now;
	}

	return {
		get rate() {
			return rate;
		},
		beginMessage,
		reset,
		addDelta(text: string, now = Date.now()) {
			if (text.length === 0 || !Number.isFinite(now)) return;
			if (firstDeltaAt === undefined) firstDeltaAt = now;
			estimatedTokens += estimateTokens(text);
			pushSample(estimatedTokens, now);
		},
		finish(message: AssistantRateMessage, endedAt = Date.now()) {
			const output = message.usage.output;
			if (typeof output !== "number" || !(output > 0)) return;
			const elapsed = generationMs(message, firstDeltaAt, endedAt);
			if (elapsed === undefined) return;
			const responseRate = output / (elapsed / 1000);
			if (!Number.isFinite(responseRate) || responseRate < 0) return;
			rate = responseRate;
			rateUpdatedAt = endedAt;
		},
	};
}
