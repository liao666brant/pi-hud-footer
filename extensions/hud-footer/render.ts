import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename } from "node:path";
import { fmtDuration, fmtPercent, fmtTokens, fmtTurnDuration, shortModel } from "./format.ts";
import { getI18n } from "./i18n.ts";
import { collectStats, TOOL_ORDER } from "./stats.ts";
import type { ColorName, HudConfig, HudLanguage, HudStats } from "./types.ts";

type Theme = ExtensionContext["ui"]["theme"];
type FooterFactory = NonNullable<Parameters<ExtensionContext["ui"]["setFooter"]>[0]>;

export interface HudEditorState {
	getGitBranch?: () => string | null | undefined;
}

export interface HudBorderSegments {
	left?: string;
	center?: string;
	right?: string;
}

function contextBar(
	ratio: number,
	width: number,
	color: (text: string) => string,
	muted: (text: string) => string,
	glyphs: { filled: string; empty: string } = { filled: "━", empty: "─" },
): string {
	const safeRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
	const filled = Math.round(safeRatio * width);
	return color(glyphs.filled.repeat(filled)) + muted(glyphs.empty.repeat(width - filled));
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

function tokenMetrics(stats: HudStats) {
	const inputTotal = stats.input + stats.cacheRead + stats.cacheWrite;
	return {
		inputTotal,
		total: inputTotal + stats.output,
		cacheRate: inputTotal > 0 ? stats.cacheRead / inputTotal : 0,
	};
}

function sessionElapsed(stats: HudStats, language: HudLanguage): string {
	return stats.startedAt ? fmtDuration(Date.now() - stats.startedAt, language) : fmtDuration(0, language);
}

function contextMetrics(ctx: ExtensionContext) {
	const contextWindow = ctx.model?.contextWindow;
	const tokens = ctx.getContextUsage()?.tokens ?? 0;
	const ratio = contextWindow ? tokens / contextWindow : 0;
	return { contextWindow, tokens, ratio, color: contextUsageColor(ratio) };
}

function stateText(
	i18n: ReturnType<typeof getI18n>,
	theme: Theme,
	isRunning: () => boolean,
	lastTurnDuration: number | undefined,
): string {
	if (isRunning()) return theme.fg("accent", i18n.labels.running);
	const readyText = lastTurnDuration === undefined
		? i18n.labels.ready
		: `${i18n.labels.ready} · ${fmtTurnDuration(lastTurnDuration, i18n.language)}`;
	return theme.fg("success", readyText);
}

function toolSummary(stats: HudStats, theme: Theme, config: HudConfig): string | undefined {
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

	return parts.join(theme.fg("dim", "  |  "));
}

function toolLine(stats: HudStats, theme: Theme, width: number, config: HudConfig, label: string): string | undefined {
	if (!config.showTools || width < 60) return undefined;
	const summary = toolSummary(stats, theme, config) ?? theme.fg("dim", "-");
	return truncateToWidth(joinParts([" ", theme.fg("muted", label), summary]), width);
}

function renderHudTokenSegment(ctx: ExtensionContext, config: HudConfig, theme: Theme): string {
	const i18n = getI18n(config.language);
	const stats = collectStats(ctx);
	const metrics = tokenMetrics(stats);
	const cacheColor = cacheRateColor(metrics.cacheRate);
	const tokenLabel = i18n.language === "zh" ? "词元" : "tok";
	const breakdown = `↑${fmtTokens(stats.input)} ↓${fmtTokens(stats.output)} ⇣${fmtTokens(stats.cacheRead)} ⇡${fmtTokens(stats.cacheWrite)}`;
	const cache = `⚡${fmtPercent(metrics.cacheRate)}`;

	return joinParts([
		theme.fg("muted", tokenLabel),
		theme.fg("text", fmtTokens(metrics.total)),
		theme.fg("dim", "·"),
		theme.fg("dim", breakdown),
		config.showCacheRate ? theme.fg("dim", "·") : undefined,
		config.showCacheRate ? theme.fg(cacheColor, cache) : undefined,
	]);
}

export function renderHudTopBorderSegments(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	config: HudConfig,
	theme: Theme,
	getGitBranch: () => string | null | undefined,
): HudBorderSegments {
	const i18n = getI18n(config.language);
	const branch = getGitBranch();
	const project = basename(ctx.cwd);
	const model = theme.fg("accent", `[${shortModel(ctx)} ${pi.getThinkingLevel()}]`);
	const stats = collectStats(ctx);
	const elapsed = sessionElapsed(stats, i18n.language);
	const runMetrics = [
		config.showElapsed ? theme.fg("muted", `${i18n.labels.elapsed} ${elapsed}`) : undefined,
		config.showCost ? theme.fg("muted", `${i18n.labels.cost} $${stats.cost.toFixed(2)}`) : undefined,
	]
		.filter(Boolean)
		.join(theme.fg("dim", " | "));
	const location = branch
		? `${theme.fg("warning", project)}${theme.fg("dim", "@")}${theme.fg("accent", branch)}`
		: theme.fg("warning", project);

	return { left: joinParts([model, runMetrics || undefined]), right: location };
}

export function renderHudBottomBorderSegments(
	ctx: ExtensionContext,
	config: HudConfig,
	isRunning: () => boolean,
	getLastTurnDuration: () => number | undefined,
	theme: Theme,
): HudBorderSegments {
	const i18n = getI18n(config.language);
	const context = contextMetrics(ctx);
	const barWidth = Math.min(config.barWidth, 12);
	const bar = contextBar(context.ratio, barWidth, (s) => theme.fg(context.color, s), (s) => theme.fg("dim", s));
	const contextText = theme.fg(
		context.color,
		`${fmtPercent(context.ratio)} ${fmtTokens(context.tokens)}/${fmtTokens(context.contextWindow ?? 0)}`,
	);

	return {
		left: joinParts([theme.fg("muted", i18n.labels.context), bar, contextText]),
		center: renderHudTokenSegment(ctx, config, theme),
		right: stateText(i18n, theme, isRunning, getLastTurnDuration()),
	};
}

function renderBorderFooterLines(ctx: ExtensionContext, config: HudConfig, theme: Theme, width: number): string[] {
	const i18n = getI18n(config.language);
	const stats = collectStats(ctx);
	const tools = toolLine(stats, theme, width, config, i18n.labels.tools);
	return tools ? [tools] : [];
}

function renderClassicFooterLines(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	config: HudConfig,
	isRunning: () => boolean,
	getLastTurnDuration: () => number | undefined,
	theme: Theme,
	width: number,
	getGitBranch: () => string | null | undefined,
): string[] {
	const i18n = getI18n(config.language);
	const stats = collectStats(ctx);
	const branch = getGitBranch();
	const context = contextMetrics(ctx);
	const tokens = tokenMetrics(stats);
	const cacheColor = cacheRateColor(tokens.cacheRate);
	const elapsed = sessionElapsed(stats, i18n.language);
	const tokenBreakdown = i18n.labels.tokenBreakdown(
		fmtTokens(stats.input),
		fmtTokens(stats.output),
		fmtTokens(stats.cacheRead),
		fmtTokens(stats.cacheWrite),
	);
	const project = basename(ctx.cwd);
	const topLeft = theme.fg("accent", `[${shortModel(ctx)} (${pi.getThinkingLevel()})]`);
	const bar = contextBar(
		context.ratio,
		config.barWidth,
		(s) => theme.fg(context.color, s),
		(s) => theme.fg("dim", s),
		{ filled: "█", empty: "░" },
	);
	const contextText = theme.fg(
		context.color,
		`${fmtPercent(context.ratio)} (${fmtTokens(context.tokens)}/${fmtTokens(context.contextWindow ?? 0)})`,
	);
	const git = branch
		? `${theme.fg("warning", project)} ${theme.fg("muted", "git:")}${theme.fg("accent", `(${branch})`)}`
		: theme.fg("warning", project);

	const line1 = truncateToWidth(
		joinParts([
			" ",
			topLeft,
			bar,
			contextText,
			theme.fg("dim", "|"),
			git,
			theme.fg("dim", "|"),
			stateText(i18n, theme, isRunning, getLastTurnDuration()),
		]),
		width,
	);
	const line2 = truncateToWidth(
		joinParts([
			" ",
			theme.fg("muted", i18n.labels.tokens),
			theme.fg("text", fmtTokens(tokens.total)),
			theme.fg("dim", tokenBreakdown),
			config.showCacheRate ? theme.fg("dim", "|") : undefined,
			config.showCacheRate
				? theme.fg(cacheColor, `${i18n.labels.cacheRate} ${fmtPercent(tokens.cacheRate)}`)
				: undefined,
			config.showElapsed ? theme.fg("dim", "|") : undefined,
			config.showElapsed ? theme.fg("muted", `${i18n.labels.elapsed} ${elapsed}`) : undefined,
			config.showCost ? theme.fg("dim", "|") : undefined,
			config.showCost ? theme.fg("muted", `${i18n.labels.cost} $${stats.cost.toFixed(2)}`) : undefined,
		]),
		width,
	);

	const lines = [line1, line2];
	const tools = toolLine(stats, theme, width, config, i18n.labels.tools);
	if (tools) lines.push(tools);
	return lines;
}

export function createHudFooter(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	config: HudConfig,
	isRunning: () => boolean,
	getLastTurnDuration: () => number | undefined,
	editorState?: HudEditorState,
): FooterFactory {
	return (tui, theme, footerData) => {
		if (editorState) editorState.getGitBranch = () => footerData.getGitBranch();
		const disposeBranch = footerData.onBranchChange(() => tui.requestRender());

		return {
			dispose: disposeBranch,
			invalidate() {},
			render(width: number): string[] {
				const lines = config.style === "classic"
					? renderClassicFooterLines(
						pi,
						ctx,
						config,
						isRunning,
						getLastTurnDuration,
						theme,
						width,
						() => footerData.getGitBranch(),
					)
					: renderBorderFooterLines(ctx, config, theme, width);

				return lines.map((line) => {
					if (visibleWidth(line) <= width) return line;
					return truncateToWidth(line, width);
				});
			},
		};
	};
}
