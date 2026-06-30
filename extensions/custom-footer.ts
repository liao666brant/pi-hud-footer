import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_CONFIG, isDisplayEnabled, loadConfig, normalizeStyle, saveConfigStyle } from "./hud-footer/config.ts";
import { createHudEditorFactory } from "./hud-footer/editor.ts";
import { fmtTurnDuration } from "./hud-footer/format.ts";
import { getI18n } from "./hud-footer/i18n.ts";
import { createHudFooter, type HudEditorState } from "./hud-footer/render.ts";
import type { HudConfig, HudStyle } from "./hud-footer/types.ts";

const ACTIVE_EXTENSION_KEY = Symbol.for("pi-hud-footer.active");
const TOKEN_RATE_WINDOW_MS = 2000;
const MIN_TOKEN_RATE_MS = 500;
// ponytail: estimate streaming tokens from text deltas until providers expose live usage.
const CHARS_PER_TOKEN = 4;
type HudGlobal = typeof globalThis & { [ACTIVE_EXTENSION_KEY]?: boolean };
type TokenRateSource = "usage" | "estimate";
type TokenRateSample = { outputTokens: number; timestamp: number; source: TokenRateSource };

export default function (pi: ExtensionAPI) {
	const hudGlobal = globalThis as HudGlobal;
	if (hudGlobal[ACTIVE_EXTENSION_KEY]) return;
	hudGlobal[ACTIVE_EXTENSION_KEY] = true;

	let runtimeEnabled: boolean | undefined;
	let running = false;
	let agentStartedAt: number | undefined;
	let tokenRateSample: TokenRateSample | undefined;
	let estimatedOutputTokens = 0;
	let lastTurnDuration: number | undefined;
	let lastTokenRate: number | undefined;
	let runningTimer: ReturnType<typeof setInterval> | undefined;
	let config: HudConfig = { ...DEFAULT_CONFIG };
	let editorInstalled = false;
	let previousEditorFactory: ReturnType<ExtensionContext["ui"]["getEditorComponent"]> | undefined;
	const editorState: HudEditorState = {};
	const commandI18n = getI18n(DEFAULT_CONFIG.language);

	function currentI18n() {
		return getI18n(config.language);
	}

	function isEnabled(): boolean {
		return runtimeEnabled ?? config.enabled;
	}

	function isRunning(): boolean {
		return running;
	}

	function getLastTurnDuration(): number | undefined {
		return lastTurnDuration;
	}

	function getLastTokenRate(): number | undefined {
		return lastTokenRate;
	}

	function setTokenRateSample(outputTokens: number, source: TokenRateSource, timestamp = Date.now()) {
		tokenRateSample = { outputTokens, timestamp, source };
	}

	function resetTokenRate() {
		estimatedOutputTokens = 0;
		setTokenRateSample(0, "usage");
		lastTokenRate = undefined;
	}

	function deltaTokensFromUpdate(update: unknown): number {
		if (typeof update !== "object" || update === null || !("delta" in update)) return 0;
		const delta = (update as { delta?: unknown }).delta;
		if (typeof delta !== "string") return 0;
		return delta.length / CHARS_PER_TOKEN;
	}

	function updateMessageTokenRate(message: { usage: { output: number } }, deltaTokens = 0) {
		if (message.usage.output > 0) {
			updateTokenRate(message.usage.output, "usage");
			return;
		}

		estimatedOutputTokens += deltaTokens;
		updateTokenRate(estimatedOutputTokens, "estimate");
	}

	function updateTokenRate(outputTokens: number, source: TokenRateSource) {
		const now = Date.now();
		if (!Number.isFinite(outputTokens)) return;
		if (!tokenRateSample || source !== tokenRateSample.source || outputTokens < tokenRateSample.outputTokens) {
			setTokenRateSample(outputTokens, source, now);
			return;
		}

		const deltaTokens = outputTokens - tokenRateSample.outputTokens;
		const deltaMs = now - tokenRateSample.timestamp;
		if (deltaMs > TOKEN_RATE_WINDOW_MS) {
			setTokenRateSample(outputTokens, source, now);
			return;
		}
		if (deltaTokens <= 0 || deltaMs < MIN_TOKEN_RATE_MS) return;

		lastTokenRate = deltaTokens / (deltaMs / 1000);
		tokenRateSample = { outputTokens, timestamp: now, source };
	}

	function updateRunningMessage(ctx: ExtensionContext) {
		if (agentStartedAt === undefined) return;
		const i18n = currentI18n();
		const elapsed = fmtTurnDuration(Date.now() - agentStartedAt, i18n.language);
		ctx.ui.setWorkingMessage(i18n.workingMessage(elapsed));
	}

	function stopRunningTimer(ctx?: ExtensionContext) {
		if (runningTimer) {
			clearInterval(runningTimer);
			runningTimer = undefined;
		}
		ctx?.ui.setWorkingMessage();
	}

	function startRunningTimer(ctx: ExtensionContext) {
		stopRunningTimer();
		if (!isDisplayEnabled(config, "turnDuration") || ctx.mode !== "tui") return;
		updateRunningMessage(ctx);
		runningTimer = setInterval(() => updateRunningMessage(ctx), 1000);
	}

	function installEditor(ctx: ExtensionContext) {
		if (ctx.mode !== "tui") return;
		if (!editorInstalled) previousEditorFactory = ctx.ui.getEditorComponent();
		ctx.ui.setEditorComponent(
			createHudEditorFactory(
				pi,
				ctx,
				config,
				isRunning,
				getLastTurnDuration,
				getLastTokenRate,
				editorState,
			),
		);
		editorInstalled = true;
	}

	function uninstallEditor(ctx: ExtensionContext) {
		if (!editorInstalled || ctx.mode !== "tui") return;
		ctx.ui.setEditorComponent(previousEditorFactory);
		previousEditorFactory = undefined;
		editorInstalled = false;
	}

	function clearHud(ctx: ExtensionContext) {
		ctx.ui.setFooter(undefined);
		uninstallEditor(ctx);
	}

	function applyHud(ctx: ExtensionContext) {
		config = loadConfig(ctx);

		if (!isEnabled()) {
			clearHud(ctx);
			return;
		}

		if (config.style === "border") installEditor(ctx);
		else uninstallEditor(ctx);
		ctx.ui.setFooter(
			createHudFooter(
				pi,
				ctx,
				config,
				isRunning,
				getLastTurnDuration,
				getLastTokenRate,
				editorState,
			),
		);
	}

	function styleOptions(i18n = currentI18n()): string[] {
		return [`1 - ${i18n.styleNames.classic}`, `2 - ${i18n.styleNames.border}`];
	}

	function parseStyleChoice(value: string | undefined): HudStyle | undefined {
		if (!value) return undefined;
		const trimmed = value.trim();
		if (trimmed.startsWith("1 -")) return "classic";
		if (trimmed.startsWith("2 -")) return "border";
		return normalizeStyle(trimmed);
	}

	async function chooseStyle(args: string, ctx: ExtensionContext): Promise<HudStyle | undefined> {
		const trimmedArgs = args.trim();
		const fromArgs = parseStyleChoice(trimmedArgs);
		if (fromArgs) return fromArgs;
		if (trimmedArgs) return undefined;
		if (ctx.mode === "tui") {
			const selected = await ctx.ui.select(currentI18n().styleSelectTitle, styleOptions());
			return parseStyleChoice(selected);
		}
		return config.style === "classic" ? "border" : "classic";
	}

	pi.on("session_start", (_event, ctx) => {
		resetTokenRate();
		applyHud(ctx);
	});

	pi.on("agent_start", (_event, ctx) => {
		running = true;
		agentStartedAt = Date.now();
		startRunningTimer(ctx);
	});

	pi.on("turn_start", () => {
		resetTokenRate();
	});

	pi.on("message_update", (event) => {
		if (event.message.role !== "assistant") return;
		updateMessageTokenRate(event.message, deltaTokensFromUpdate(event.assistantMessageEvent));
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant") return;
		updateMessageTokenRate(event.message);
	});

	pi.on("agent_end", (_event, ctx) => {
		running = false;
		const elapsed = agentStartedAt === undefined ? undefined : Date.now() - agentStartedAt;
		if (elapsed !== undefined) lastTurnDuration = elapsed;
		agentStartedAt = undefined;
		stopRunningTimer(ctx);
		if (isDisplayEnabled(config, "turnDuration") && elapsed !== undefined && ctx.hasUI) {
			const i18n = currentI18n();
			const turnDuration = fmtTurnDuration(elapsed, i18n.language);
			ctx.ui.notify(i18n.turnDurationNotification(turnDuration), "info");
		}
	});

	pi.on("session_shutdown", (_event, ctx) => {
		stopRunningTimer(ctx);
		uninstallEditor(ctx);
		delete hudGlobal[ACTIVE_EXTENSION_KEY];
	});

	pi.registerCommand("hud-footer", {
		description: commandI18n.commands.toggleDescription,
		handler: async (_args, ctx) => {
			runtimeEnabled = !isEnabled();
			if (runtimeEnabled) {
				applyHud(ctx);
				ctx.ui.notify(currentI18n().footerEnabled, "info");
				return;
			}

			clearHud(ctx);
			ctx.ui.notify(currentI18n().footerDisabled, "info");
		},
	});

	pi.registerCommand("hud-footer-reload", {
		description: commandI18n.commands.reloadDescription,
		handler: async (_args, ctx) => {
			applyHud(ctx);
			ctx.ui.notify(currentI18n().configReloaded, "info");
		},
	});

	async function handleThemeCommand(args: string, ctx: ExtensionContext) {
		const nextStyle = await chooseStyle(args, ctx);
		if (!nextStyle) {
			ctx.ui.notify(currentI18n().commands.styleDescription, "warning");
			return;
		}

		try {
			saveConfigStyle(ctx, nextStyle);
		} catch (error) {
			console.error("[pi-hud-footer] Failed to save style:", error);
			ctx.ui.notify(currentI18n().styleSaveFailed, "error");
			return;
		}

		applyHud(ctx);
		ctx.ui.notify(currentI18n().styleSaved(currentI18n().styleNames[nextStyle]), "info");
	}

	pi.registerCommand("hud-footer-theme", {
		description: commandI18n.commands.styleDescription,
		handler: handleThemeCommand,
	});
}
