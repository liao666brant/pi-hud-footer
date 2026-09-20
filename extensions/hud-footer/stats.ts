import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { HudStats, HudUsageScope } from "./types.ts";

export const TOOL_ORDER = ["edit", "write", "bash", "read", "grep", "find", "ls"];
const statsCache = new WeakMap<object, { key: string; stats: HudStats }>();

type UsageTotals = Pick<HudStats, "input" | "output" | "cacheRead" | "cacheWrite" | "cost">;

interface SessionUsage {
	totals: UsageTotals;
	latestCacheHitRate: number | undefined;
}

function createUsageTotals(): UsageTotals {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
	};
}

function timestampToMs(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeUsage(value: unknown): UsageTotals | undefined {
	if (!isRecord(value)) return undefined;
	return {
		input: numericValue(value.input),
		output: numericValue(value.output),
		cacheRead: numericValue(value.cacheRead),
		cacheWrite: numericValue(value.cacheWrite),
		cost: isRecord(value.cost) ? numericValue(value.cost.total) : 0,
	};
}

function addUsage(total: UsageTotals, usage: UsageTotals): void {
	total.input += usage.input;
	total.output += usage.output;
	total.cacheRead += usage.cacheRead;
	total.cacheWrite += usage.cacheWrite;
	total.cost += usage.cost;
}

function collectBranchStats(entries: SessionEntry[]): HudStats {
	const stats: HudStats = {
		...createUsageTotals(),
		tools: new Map(),
	};

	for (const entry of entries) {
		const entryTime = timestampToMs((entry as { timestamp?: unknown }).timestamp);
		if (entryTime !== undefined) stats.startedAt = Math.min(stats.startedAt ?? entryTime, entryTime);

		if (entry.type !== "message") continue;
		const message: unknown = entry.message;
		if (!isRecord(message)) continue;
		const role = (message as { role?: unknown }).role;

		if (role === "assistant") {
			const usage = normalizeUsage(message.usage);
			if (!usage) continue;
			addUsage(stats, usage);
			const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
			stats.latestCacheHitRate = promptTokens > 0 ? usage.cacheRead / promptTokens : undefined;
			continue;
		}

		if (role === "toolResult" && typeof message.toolName === "string") {
			const current = stats.tools.get(message.toolName) ?? { ok: 0, error: 0 };
			if (message.isError) current.error++;
			else current.ok++;
			stats.tools.set(message.toolName, current);
		}
	}

	return stats;
}

function collectSessionUsage(entries: SessionEntry[]): SessionUsage {
	const totals = createUsageTotals();
	let latestCacheHitRate: number | undefined;

	for (const entry of entries) {
		let usage: UsageTotals | undefined;

		if (entry.type === "usage") {
			usage = normalizeUsage(entry.usage);
		} else if (entry.type === "message") {
			const message: unknown = entry.message;
			if (isRecord(message) && (message.role === "assistant" || message.role === "toolResult")) {
				usage = normalizeUsage(message.usage);
				if (usage && message.role === "assistant") {
					const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
					latestCacheHitRate = promptTokens > 0 ? usage.cacheRead / promptTokens : undefined;
				}
			}
		} else if (entry.type === "compaction" || entry.type === "branch_summary") {
			usage = normalizeUsage((entry as unknown as Record<string, unknown>).usage);
		}

		if (usage) addUsage(totals, usage);
	}

	return { totals, latestCacheHitRate };
}

function statsCacheKey(branch: SessionEntry[], entries: SessionEntry[] | undefined, usageScope: HudUsageScope): string {
	const branchLast = branch[branch.length - 1] as { id?: unknown; timestamp?: unknown } | undefined;
	const parts = [usageScope, String(branch.length), String(branchLast?.id), String(branchLast?.timestamp)];
	if (entries) {
		const entriesLast = entries[entries.length - 1] as { id?: unknown } | undefined;
		parts.push(String(entries.length), String(entriesLast?.id));
	}
	return parts.join(":");
}

export function collectStats(ctx: ExtensionContext, usageScope: HudUsageScope): HudStats {
	const branch = ctx.sessionManager.getBranch();
	const entries = usageScope === "session" ? ctx.sessionManager.getEntries() : undefined;
	const key = statsCacheKey(branch, entries, usageScope);

	const cached = statsCache.get(ctx);
	if (cached?.key === key) return cached.stats;

	const branchStats = collectBranchStats(branch);
	if (!entries) {
		statsCache.set(ctx, { key, stats: branchStats });
		return branchStats;
	}

	const sessionUsage = collectSessionUsage(entries);
	const stats: HudStats = {
		...branchStats,
		...sessionUsage.totals,
		latestCacheHitRate: sessionUsage.latestCacheHitRate,
	};

	statsCache.set(ctx, { key, stats });
	return stats;
}
