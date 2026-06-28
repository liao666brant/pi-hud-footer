import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename } from "node:path";
import { fmtDuration, fmtPercent, fmtTokens, fmtTurnDuration, shortModel } from "./format.ts";
import { collectStats, TOOL_ORDER } from "./stats.ts";
import type { ColorName, HudConfig, HudStats } from "./types.ts";

type Theme = ExtensionContext["ui"]["theme"];
type FooterFactory = NonNullable<Parameters<ExtensionContext["ui"]["setFooter"]>[0]>;

function contextBar(
	ratio: number,
	width: number,
	color: (text: string) => string,
	muted: (text: string) => string,
): string {
	const safeRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
	const filled = Math.round(safeRatio * width);
	return color("█".repeat(filled)) + muted("░".repeat(width - filled));
}

function joinParts(parts: Array<string | undefined>): string {
	return parts.filter(Boolean).join(" ");
}

function contextUsageColor(ratio: number): ColorName {
	if (ratio >= 0.9) return "error";
	if (ratio >= 0.7) return "warning";
	return "success";
}

function cacheRateColor(rate: number): ColorName {
	if (rate >= 0.5) return "success";
	if (rate > 0) return "warning";
	return "dim";
}

function toolLine(stats: HudStats, theme: Theme, width: number, config: HudConfig): string | undefined {
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
		const ok = count.ok > 0 ? theme.fg("success", `×${count.ok}`) : undefined;
		const error = count.error > 0 ? theme.fg("error", `×${count.error}`) : undefined;
		return joinParts([theme.fg("muted", name), ok, error]);
	});

	return truncateToWidth(`  ${parts.join(theme.fg("dim", "  |  "))}`, width);
}

export function createHudFooter(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	config: HudConfig,
	isRunning: () => boolean,
	getLastTurnDuration: () => number | undefined,
): FooterFactory {
	return (tui, theme, footerData) => {
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

				const pctColor = contextUsageColor(contextRatio);
				const cacheColor = cacheRateColor(cacheRate);
				const lastTurnDuration = getLastTurnDuration();
				const readyText = lastTurnDuration === undefined ? "✓ ready" : `✓ ready · ${fmtTurnDuration(lastTurnDuration)}`;
				const state = isRunning() ? theme.fg("accent", "● running") : theme.fg("success", readyText);
				const project = basename(ctx.cwd);

				const topLeft = theme.fg("accent", `[${shortModel(ctx)} (${pi.getThinkingLevel()})]`);
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
						theme.fg("muted", "词元:"),
						theme.fg("text", fmtTokens(totalTokens)),
						theme.fg(
							"dim",
							`(输入 ${fmtTokens(stats.input)} / 输出 ${fmtTokens(stats.output)} / 缓存 R${fmtTokens(stats.cacheRead)} W${fmtTokens(stats.cacheWrite)})`,
						),
						config.showCacheRate ? theme.fg("dim", "|") : undefined,
						config.showCacheRate ? theme.fg(cacheColor, `缓存率 ${fmtPercent(cacheRate)}`) : undefined,
						config.showElapsed ? theme.fg("dim", "|") : undefined,
						config.showElapsed ? theme.fg("muted", `耗时 ${elapsed}`) : undefined,
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
	};
}
