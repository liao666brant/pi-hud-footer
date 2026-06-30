import { CustomEditor, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import {
	renderHudBottomBorderSegments,
	renderHudTopBorderSegments,
	type HudBorderSegments,
	type HudEditorState,
} from "./render.ts";
import type { HudConfig } from "./types.ts";

type EditorFactory = NonNullable<Parameters<ExtensionContext["ui"]["setEditorComponent"]>[0]>;
type Tui = Parameters<EditorFactory>[0];
type EditorTheme = Parameters<EditorFactory>[1];
type Keybindings = Parameters<EditorFactory>[2];

const ANSI_PATTERN = /\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\)|[@-Z\\-_])/g;

function stripAnsi(text: string): string {
	return text.replace(ANSI_PATTERN, "");
}

function isEditorBorderLine(line: string): boolean {
	const plain = stripAnsi(line);
	if (!plain.includes("─")) return false;
	return plain.replace(/[─\s↑↓0-9more]/g, "").length === 0;
}

function findTopBorderIndex(lines: string[]): number {
	for (let index = 0; index < lines.length; index++) {
		const plain = stripAnsi(lines[index] ?? "");
		if (!isEditorBorderLine(lines[index] ?? "")) continue;
		// Keep pi's built-in scroll-up hint visible for very long prompts.
		if (plain.includes("↑")) return -1;
		return index;
	}
	return -1;
}

function findBottomBorderIndex(lines: string[]): number {
	for (let index = lines.length - 1; index >= 0; index--) {
		const plain = stripAnsi(lines[index] ?? "");
		if (!isEditorBorderLine(lines[index] ?? "")) continue;
		// Keep pi's built-in scroll-down hint visible for very long prompts.
		if (plain.includes("↓")) return -1;
		return index;
	}
	return -1;
}

function rawLabelWidth(text: string | undefined): number {
	return text ? visibleWidth(text) + 2 : 0;
}

function makeLabel(text: string | undefined, maxWidth: number): string {
	if (!text || maxWidth < 4) return "";
	return ` ${truncateToWidth(text, Math.max(1, maxWidth - 2), "…")} `;
}

function embeddedBorderLine(
	segments: HudBorderSegments,
	width: number,
	borderColor: (value: string) => string,
): string | undefined {
	if (width < 20 || (!segments.left && !segments.center && !segments.right)) return undefined;

	if (!segments.center) {
		const availableForLabels = Math.max(0, width - 3);
		let leftMax = Math.min(rawLabelWidth(segments.left), Math.floor(availableForLabels * 0.68));
		let rightMax = Math.min(rawLabelWidth(segments.right), availableForLabels - leftMax);

		// Reallocate unused room to the other side before truncating.
		const unusedAfterRight = availableForLabels - leftMax - rightMax;
		leftMax = Math.min(rawLabelWidth(segments.left), leftMax + unusedAfterRight);
		const unusedAfterLeft = availableForLabels - leftMax - rightMax;
		rightMax = Math.min(rawLabelWidth(segments.right), rightMax + unusedAfterLeft);

		const leftLabel = makeLabel(segments.left, leftMax);
		const rightLabel = makeLabel(segments.right, rightMax);
		const labelWidth = visibleWidth(leftLabel) + visibleWidth(rightLabel);
		if (labelWidth === 0) return undefined;

		const middleWidth = Math.max(1, width - 2 - labelWidth);
		let line = borderColor("─") + leftLabel + borderColor("─".repeat(middleWidth)) + rightLabel + borderColor("─");
		const lineWidth = visibleWidth(line);
		if (lineWidth < width) line += borderColor("─".repeat(width - lineWidth));
		if (visibleWidth(line) > width) return truncateToWidth(line, width, "");
		return line;
	}

	const sideBudget = Math.max(0, width - 8);
	const leftLabel = makeLabel(segments.left, Math.min(rawLabelWidth(segments.left), Math.floor(sideBudget * 0.25)));
	const rightLabel = makeLabel(segments.right, Math.min(rawLabelWidth(segments.right), Math.floor(sideBudget * 0.18)));
	const maxCenterWidth = Math.max(4, width - 4 - visibleWidth(leftLabel) - visibleWidth(rightLabel));
	const centerLabel = makeLabel(segments.center, maxCenterWidth);
	const labelWidth = visibleWidth(leftLabel) + visibleWidth(centerLabel) + visibleWidth(rightLabel);
	if (labelWidth === 0) return undefined;

	const centerWidth = visibleWidth(centerLabel);
	const minCenterStart = 1 + visibleWidth(leftLabel) + 1;
	const maxCenterStart = width - 1 - visibleWidth(rightLabel) - 1 - centerWidth;
	const idealCenterStart = Math.floor((width - centerWidth) / 2);
	const centerStart = Math.max(minCenterStart, Math.min(maxCenterStart, idealCenterStart));
	const leftFillWidth = Math.max(1, centerStart - 1 - visibleWidth(leftLabel));
	const rightFillWidth = Math.max(1, width - 1 - visibleWidth(rightLabel) - (centerStart + centerWidth));

	let line =
		borderColor("─") +
		leftLabel +
		borderColor("─".repeat(leftFillWidth)) +
		centerLabel +
		borderColor("─".repeat(rightFillWidth)) +
		rightLabel +
		borderColor("─");
	const lineWidth = visibleWidth(line);
	if (lineWidth < width) line += borderColor("─".repeat(width - lineWidth));
	if (visibleWidth(line) > width) return truncateToWidth(line, width, "");
	return line;
}

class HudEditor extends CustomEditor {
	constructor(
		tui: Tui,
		theme: EditorTheme,
		keybindings: Keybindings,
		private readonly renderTop: () => HudBorderSegments,
		private readonly renderBottom: () => HudBorderSegments,
	) {
		super(tui, theme, keybindings);
	}

	override render(width: number): string[] {
		const lines = super.render(width);
		const topBorderIndex = findTopBorderIndex(lines);
		if (topBorderIndex !== -1) {
			const border = embeddedBorderLine(this.renderTop(), width, this.borderColor);
			if (border) lines[topBorderIndex] = border;
		}

		const bottomBorderIndex = findBottomBorderIndex(lines);
		if (bottomBorderIndex !== -1 && bottomBorderIndex !== topBorderIndex) {
			const border = embeddedBorderLine(this.renderBottom(), width, this.borderColor);
			if (border) lines[bottomBorderIndex] = border;
		}

		return lines;
	}
}

export function createHudEditorFactory(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	config: HudConfig,
	isRunning: () => boolean,
	getLastTurnDuration: () => number | undefined,
	getLastTokenRate: () => number | undefined,
	state: HudEditorState,
): EditorFactory {
	return (tui, theme, keybindings) =>
		new HudEditor(
			tui,
			theme,
			keybindings,
			() => renderHudTopBorderSegments(pi, ctx, config, ctx.ui.theme, () => state.getGitBranch?.()),
			() => renderHudBottomBorderSegments(
				ctx,
				config,
				isRunning,
				getLastTurnDuration,
				getLastTokenRate,
				ctx.ui.theme,
			),
		);
}
