import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename } from "node:path";
import { isDisplayEnabled } from "./config.ts";
import { fmtDuration, fmtPercent, fmtTokenRate, fmtTokens, fmtTurnDuration, shortModel } from "./format.ts";
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

function joinWithSeparator(parts: Array<string | undefined>, separator: string): string {
	return parts.filter(Boolean).join(separator);
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

function visibleCacheTokens(stats: HudStats): { read?: string; write?: string } {
	return {
		read: stats.cacheRead > 0 ? fmtTokens(stats.cacheRead) : undefined,
		write: stats.cacheWrite > 0 ? fmtTokens(stats.cacheWrite) : undefined,
	};
}

function tokenRateText(rate: number | undefined, theme: Theme, label?: string): string | undefined {
	if (rate === undefined) return undefined;
	const text = fmtTokenRate(rate);
	return theme.fg("muted", label ? `${label} ${text}` : text);
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

function modelText(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	config: HudConfig,
	theme: Theme,
	classic = false,
): string | undefined {
	const model = isDisplayEnabled(config, "modelName") ? shortModel(ctx) : undefined;
	const thinking = isDisplayEnabled(config, "thinkingLevel") ? pi.getThinkingLevel() : undefined;
	if (!model && !thinking) return undefined;
	if (model && thinking) {
		const label = classic ? `[${model} (${thinking})]` : `[${model} ${thinking}]`;
		return theme.fg("accent", label);
	}
	return theme.fg("accent", `[${model ?? thinking}]`);
}

function locationText(
	ctx: ExtensionContext,
	branch: string | null | undefined,
	config: HudConfig,
	theme: Theme,
	classic = false,
): string | undefined {
	const project = isDisplayEnabled(config, "projectName") ? basename(ctx.cwd) : undefined;
	const gitBranch = isDisplayEnabled(config, "gitBranch") ? branch : undefined;
	if (project && gitBranch) {
		if (classic) {
			return `${theme.fg("warning", project)} ${theme.fg("muted", "git:")}${theme.fg("accent", `(${gitBranch})`)}`;
		}
		return `${theme.fg("warning", project)}${theme.fg("dim", "@")}${theme.fg("accent", gitBranch)}`;
	}
	if (project) return theme.fg("warning", project);
	if (gitBranch) {
		if (classic) return `${theme.fg("muted", "git:")}${theme.fg("accent", `(${gitBranch})`)}`;
		return theme.fg("accent", gitBranch);
	}
	return undefined;
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
	if (!isDisplayEnabled(config, "toolsLine") || width < 60) return undefined;
	const summary = toolSummary(stats, theme, config);
	if (!summary) return undefined;
	return truncateToWidth(joinParts([" ", theme.fg("muted", label), summary]), width);
}

function renderHudTokenSegment(
	ctx: ExtensionContext,
	config: HudConfig,
	getLastTokenRate: () => number | undefined,
	theme: Theme,
): string | undefined {
	const i18n = getI18n(config.language);
	const stats = collectStats(ctx);
	const metrics = tokenMetrics(stats);
	const cacheColor = cacheRateColor(metrics.cacheRate);
	const rate = getLastTokenRate();
	const cacheTokens = visibleCacheTokens(stats);
	const tokenBreakdown = joinParts([
		`↑${fmtTokens(stats.input)}`,
		`↓${fmtTokens(stats.output)}`,
		cacheTokens.read ? `R${cacheTokens.read}` : undefined,
		cacheTokens.write ? `W${cacheTokens.write}` : undefined,
	]);
	const total = isDisplayEnabled(config, "tokens")
		? joinParts([theme.fg("muted", i18n.language === "zh" ? "词元" : "tok"), theme.fg("text", fmtTokens(metrics.total))])
		: undefined;
	const breakdown = isDisplayEnabled(config, "tokenBreakdown")
		? theme.fg("dim", tokenBreakdown)
		: undefined;
	const tokenRate = isDisplayEnabled(config, "tokenRate") ? tokenRateText(rate, theme) : undefined;
	const cache = isDisplayEnabled(config, "cacheRate") ? theme.fg(cacheColor, `⚡${fmtPercent(metrics.cacheRate)}`) : undefined;

	return joinWithSeparator([total, breakdown, tokenRate, cache], theme.fg("dim", " · ")) || undefined;
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
	const model = modelText(pi, ctx, config, theme);
	const stats = collectStats(ctx);
	const elapsed = sessionElapsed(stats, i18n.language);
	const runMetrics = joinWithSeparator([
		isDisplayEnabled(config, "elapsed") ? theme.fg("muted", `${i18n.labels.elapsed} ${elapsed}`) : undefined,
		isDisplayEnabled(config, "cost") ? theme.fg("muted", `${i18n.labels.cost} $${stats.cost.toFixed(2)}`) : undefined,
	], theme.fg("dim", " | "));
	const location = locationText(ctx, branch, config, theme);

	return { left: joinParts([model, runMetrics || undefined]) || undefined, right: location };
}

export function renderHudBottomBorderSegments(
	ctx: ExtensionContext,
	config: HudConfig,
	isRunning: () => boolean,
	getLastTurnDuration: () => number | undefined,
	getLastTokenRate: () => number | undefined,
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
		left: isDisplayEnabled(config, "context")
			? joinParts([theme.fg("muted", i18n.labels.context), bar, contextText])
			: undefined,
		center: renderHudTokenSegment(ctx, config, getLastTokenRate, theme),
		right: isDisplayEnabled(config, "state")
			? stateText(i18n, theme, isRunning, getLastTurnDuration())
			: undefined,
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
	getLastTokenRate: () => number | undefined,
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
	const rate = getLastTokenRate();
	const cacheTokens = visibleCacheTokens(stats);
	const elapsed = sessionElapsed(stats, i18n.language);
	const tokenBreakdown = i18n.labels.tokenBreakdown(
		fmtTokens(stats.input),
		fmtTokens(stats.output),
		cacheTokens.read,
		cacheTokens.write,
	);
	const topLeft = modelText(pi, ctx, config, theme, true);
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
	const contextSegment = isDisplayEnabled(config, "context") ? joinParts([bar, contextText]) : undefined;
	const git = locationText(ctx, branch, config, theme, true);
	const state = isDisplayEnabled(config, "state") ? stateText(i18n, theme, isRunning, getLastTurnDuration()) : undefined;
	const showTokens = isDisplayEnabled(config, "tokens");
	const tokenSummary = joinParts([
		showTokens ? theme.fg("muted", i18n.labels.tokens) : undefined,
		showTokens ? theme.fg("text", fmtTokens(tokens.total)) : undefined,
		isDisplayEnabled(config, "tokenBreakdown") ? theme.fg("dim", tokenBreakdown) : undefined,
	]) || undefined;
	const cacheRate = isDisplayEnabled(config, "cacheRate")
		? theme.fg(cacheColor, `${i18n.labels.cacheRate} ${fmtPercent(tokens.cacheRate)}`)
		: undefined;
	const tokenRate = isDisplayEnabled(config, "tokenRate") ? tokenRateText(rate, theme, i18n.labels.tokenRate) : undefined;
	const elapsedText = isDisplayEnabled(config, "elapsed")
		? theme.fg("muted", `${i18n.labels.elapsed} ${elapsed}`)
		: undefined;
	const costText = isDisplayEnabled(config, "cost")
		? theme.fg("muted", `${i18n.labels.cost} $${stats.cost.toFixed(2)}`)
		: undefined;

	const line1Body = joinWithSeparator([joinParts([topLeft, contextSegment]) || undefined, git, state], theme.fg("dim", " | "));
	const line2Body = joinWithSeparator([tokenSummary, tokenRate, cacheRate, elapsedText, costText], theme.fg("dim", " | "));
	const lines = [line1Body, line2Body]
		.filter(Boolean)
		.map((line) => truncateToWidth(joinParts([" ", line]), width));
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
	getLastTokenRate: () => number | undefined,
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
						getLastTokenRate,
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
