import type { AssistantMessage } from "@earendil-works/pi-ai";
import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

type ToolStats = Map<string, { ok: number; error: number }>;

type ColorName = Parameters<ExtensionContext["ui"]["theme"]["fg"]>[0];

interface HudConfig {
	enabled: boolean;
	barWidth: number;
	showTools: boolean;
	maxTools: number;
	showCost: boolean;
	showElapsed: boolean;
	showCacheRate: boolean;
}

interface HudStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	turns: number;
	startedAt?: number;
	tools: ToolStats;
}

const DEFAULT_CONFIG: HudConfig = {
	enabled: true,
	barWidth: 18,
	showTools: true,
	maxTools: 7,
	showCost: true,
	showElapsed: true,
	showCacheRate: true,
};

const TOOL_ORDER = ["edit", "write", "bash", "read", "grep", "find", "ls"];

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.round(value)));
}

function mergeConfig(base: HudConfig, patch: unknown): HudConfig {
	if (!isObject(patch)) return base;
	return {
		enabled: typeof patch.enabled === "boolean" ? patch.enabled : base.enabled,
		barWidth: clampInt(patch.barWidth, base.barWidth, 6, 40),
		showTools: typeof patch.showTools === "boolean" ? patch.showTools : base.showTools,
		maxTools: clampInt(patch.maxTools, base.maxTools, 1, 20),
		showCost: typeof patch.showCost === "boolean" ? patch.showCost : base.showCost,
		showElapsed: typeof patch.showElapsed === "boolean" ? patch.showElapsed : base.showElapsed,
		showCacheRate: typeof patch.showCacheRate === "boolean" ? patch.showCacheRate : base.showCacheRate,
	};
}

function readJsonConfig(path: string): unknown {
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		console.warn(`[pi-hud-footer] Failed to read config ${path}:`, error);
		return undefined;
	}
}

function loadConfig(ctx: ExtensionContext): HudConfig {
	let config = { ...DEFAULT_CONFIG };
	const globalPath = join(homedir(), CONFIG_DIR_NAME, "agent", "hud-footer.json");
	config = mergeConfig(config, readJsonConfig(globalPath));

	if (ctx.isProjectTrusted()) {
		const projectPath = join(ctx.cwd, CONFIG_DIR_NAME, "hud-footer.json");
		config = mergeConfig(config, readJsonConfig(projectPath));
	}

	return config;
}

function fmtTokens(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0";
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
	return `${Math.round(value)}`;
}

function fmtPercent(value: number): string {
	if (!Number.isFinite(value)) return "0%";
	return `${Math.round(value * 100)}%`;
}

function fmtContext(value?: number): string {
	if (!value) return "ctx";
	if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M context`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}K context`;
	return `${value} context`;
}

function fmtDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "0m";
	const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function timestampToMs(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function shortModel(ctx: ExtensionContext): string {
	const id = ctx.model?.id ?? "no-model";
	return id
		.replace(/^claude-/, "")
		.replace(/^gpt-/, "gpt-")
		.replace(/-20\d{6}$/, "")
		.replace(/-latest$/, "");
}

function collectStats(ctx: ExtensionContext): HudStats {
	const stats: HudStats = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		turns: 0,
		tools: new Map(),
	};

	for (const entry of ctx.sessionManager.getBranch()) {
		const entryTime = timestampToMs((entry as { timestamp?: unknown }).timestamp);
		if (entryTime !== undefined) stats.startedAt = Math.min(stats.startedAt ?? entryTime, entryTime);

		if (entry.type !== "message") continue;
		const message = entry.message as Record<string, any>;

		if (message.role === "assistant") {
			stats.turns++;
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

function contextBar(
	ratio: number,
	width: number,
	color: (text: string) => string,
	muted: (text: string) => string,
): string {
	const safeRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
	const filled = Math.round(safeRatio * width);
	return color("▰".repeat(filled)) + muted("░".repeat(width - filled));
}

function joinParts(parts: Array<string | undefined>): string {
	return parts.filter(Boolean).join(" ");
}

function toolLine(
	stats: HudStats,
	theme: ExtensionContext["ui"]["theme"],
	width: number,
	config: HudConfig,
): string | undefined {
	const entries = [...stats.tools.entries()]
		.sort(([aName, a], [bName, b]) => {
			const ai = TOOL_ORDER.indexOf(aName);
			const bi = TOOL_ORDER.indexOf(bName);
			const ar = ai === -1 ? 99 : ai;
			const br = bi === -1 ? 99 : bi;
			return ar - br || b.ok + b.error - (a.ok + a.error) || aName.localeCompare(bName);
		})
		.slice(0, config.maxTools);

	if (entries.length === 0) return undefined;

	const parts = entries.map(([name, count]) => {
		const ok = count.ok > 0 ? theme.fg("success", `✓ ${name} ×${count.ok}`) : undefined;
		const error = count.error > 0 ? theme.fg("error", `✗ ${name} ×${count.error}`) : undefined;
		return joinParts([ok, error]);
	});

	return truncateToWidth(` ${parts.join(theme.fg("dim", "  |  "))}`, width);
}

export default function (pi: ExtensionAPI) {
	let runtimeEnabled: boolean | undefined;
	let running = false;
	let config = { ...DEFAULT_CONFIG };

	function isEnabled(): boolean {
		return runtimeEnabled ?? config.enabled;
	}

	function installFooter(ctx: ExtensionContext) {
		config = loadConfig(ctx);

		if (!isEnabled()) {
			ctx.ui.setFooter(undefined);
			return;
		}

		ctx.ui.setFooter((tui, theme, footerData) => {
			const disposeBranch = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: disposeBranch,
				invalidate() {},
				render(width: number): string[] {
					const stats = collectStats(ctx);
					const branch = footerData.getGitBranch();
					const modelContext = ctx.model?.contextWindow;
					const usage = ctx.getContextUsage();
					const contextTokens = usage?.tokens ?? 0;
					const contextRatio = modelContext ? contextTokens / modelContext : 0;
					const inputTotal = stats.input + stats.cacheRead + stats.cacheWrite;
					const cacheRate = inputTotal > 0 ? stats.cacheRead / inputTotal : 0;
					const totalTokens = inputTotal + stats.output;
					const elapsed = stats.startedAt ? fmtDuration(Date.now() - stats.startedAt) : "0m";

					const pctColor: ColorName = contextRatio >= 0.9 ? "error" : contextRatio >= 0.7 ? "warning" : "success";
					const cacheColor: ColorName = cacheRate >= 0.5 ? "success" : cacheRate > 0 ? "warning" : "dim";
					const state = running ? theme.fg("accent", "● running") : theme.fg("success", "✓ ready");
					const project = basename(ctx.cwd);

					const topLeft = theme.fg("accent", `[${shortModel(ctx)} (${fmtContext(modelContext)})]`);
					const bar = contextBar(contextRatio, config.barWidth, (s) => theme.fg(pctColor, s), (s) => theme.fg("dim", s));
					const contextText = theme.fg(
						pctColor,
						`${fmtPercent(contextRatio)} (${fmtTokens(contextTokens)}/${fmtTokens(modelContext ?? 0)})`,
					);
					const git = branch
						? `${theme.fg("warning", project)} ${theme.fg("muted", "git:")}${theme.fg("accent", `(${branch})`)}`
						: theme.fg("warning", project);

					const line1 = truncateToWidth(
						joinParts([" ", topLeft, bar, contextText, theme.fg("dim", "|"), git, theme.fg("dim", "|"), state]),
						width,
					);

					const line2 = truncateToWidth(
						joinParts([
							" ",
							theme.fg("muted", `${stats.turns} 轮`),
							theme.fg("dim", "|"),
							theme.fg("muted", "令牌:"),
							theme.fg("text", fmtTokens(totalTokens)),
							theme.fg(
								"dim",
								`(输入 ${fmtTokens(stats.input)} / 输出 ${fmtTokens(stats.output)} / 缓存 R${fmtTokens(stats.cacheRead)} W${fmtTokens(stats.cacheWrite)})`,
							),
							config.showCacheRate ? theme.fg("dim", "|") : undefined,
							config.showCacheRate ? theme.fg(cacheColor, `缓存率 ${fmtPercent(cacheRate)}`) : undefined,
							config.showElapsed ? theme.fg("dim", "|") : undefined,
							config.showElapsed ? theme.fg("muted", `⏱ ${elapsed}`) : undefined,
							config.showCost ? theme.fg("dim", "|") : undefined,
							config.showCost ? theme.fg("muted", `费用 $${stats.cost.toFixed(2)}`) : undefined,
						]),
						width,
					);

					const lines = [line1, line2];
					const tools = config.showTools ? toolLine(stats, theme, width, config) : undefined;
					if (tools && width >= 60) lines.push(tools);

					return lines.map((line) => {
						if (visibleWidth(line) <= width) return line;
						return truncateToWidth(line, width);
					});
				},
			};
		});
	}

	pi.on("session_start", (_event, ctx) => {
		installFooter(ctx);
	});

	pi.on("agent_start", () => {
		running = true;
	});

	pi.on("agent_end", () => {
		running = false;
	});

	pi.registerCommand("hud-footer", {
		description: "Toggle claude-hud style custom footer.",
		handler: async (_args, ctx) => {
			runtimeEnabled = !isEnabled();
			if (runtimeEnabled) {
				installFooter(ctx);
				ctx.ui.notify("HUD footer enabled", "info");
			} else {
				ctx.ui.setFooter(undefined);
				ctx.ui.notify("HUD footer disabled", "info");
			}
		},
	});

	pi.registerCommand("hud-footer-reload", {
		description: "Reload pi-hud-footer config.",
		handler: async (_args, ctx) => {
			installFooter(ctx);
			ctx.ui.notify("HUD footer config reloaded", "info");
		},
	});
}
