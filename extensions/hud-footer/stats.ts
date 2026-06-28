import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { HudStats } from "./types.ts";

export const TOOL_ORDER = ["edit", "write", "bash", "read", "grep", "find", "ls"];

function timestampToMs(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function collectStats(ctx: ExtensionContext): HudStats {
	const stats: HudStats = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		tools: new Map(),
	};

	for (const entry of ctx.sessionManager.getBranch()) {
		const entryTime = timestampToMs((entry as { timestamp?: unknown }).timestamp);
		if (entryTime !== undefined) stats.startedAt = Math.min(stats.startedAt ?? entryTime, entryTime);

		if (entry.type !== "message") continue;
		const message = entry.message;
		if (!isRecord(message)) continue;

		if (message.role === "assistant") {
			const usage = (message as AssistantMessage).usage;
			if (!usage) continue;
			stats.input += usage.input || 0;
			stats.output += usage.output || 0;
			stats.cacheRead += usage.cacheRead || 0;
			stats.cacheWrite += usage.cacheWrite || 0;
			stats.cost += usage.cost?.total || 0;
			continue;
		}

		if (message.role === "toolResult" && typeof message.toolName === "string") {
			const current = stats.tools.get(message.toolName) ?? { ok: 0, error: 0 };
			if (message.isError) current.error++;
			else current.ok++;
			stats.tools.set(message.toolName, current);
		}
	}

	return stats;
}
