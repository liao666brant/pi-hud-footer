import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export type ToolStats = Map<string, { ok: number; error: number }>;

export type ColorName = Parameters<ExtensionContext["ui"]["theme"]["fg"]>[0];
export type HudLanguage = "en" | "zh";
export type HudLanguageSetting = HudLanguage | "auto";
export type HudStyle = "classic" | "border";
export const HUD_DISPLAY_SCOPES = ["all", "classic", "border"] as const;
export const HUD_DISPLAY_KEYS = [
	"toolsLine",
	"modelName",
	"thinkingLevel",
	"projectName",
	"gitBranch",
	"context",
	"tokens",
	"tokenBreakdown",
	"tokenRate",
	"cacheRate",
	"elapsed",
	"cost",
	"state",
	"turnDuration",
] as const;
export type HudDisplayKey = (typeof HUD_DISPLAY_KEYS)[number];
export type HudDisplayScope = (typeof HUD_DISPLAY_SCOPES)[number];
export type HudDisplayConfig = Partial<Record<HudDisplayScope, Partial<Record<HudDisplayKey, boolean>>>>;

export interface HudConfig {
	enabled: boolean;
	language: HudLanguageSetting;
	style: HudStyle;
	display: HudDisplayConfig;
	barWidth: number;
	maxTools: number;
}

export interface HudStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	startedAt?: number;
	tools: ToolStats;
}
