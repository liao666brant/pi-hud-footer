import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export type ToolStats = Map<string, { ok: number; error: number }>;

export type ColorName = Parameters<ExtensionContext["ui"]["theme"]["fg"]>[0];
export type HudLanguage = "en" | "zh";
export type HudLanguageSetting = HudLanguage | "auto";
export type HudStyle = "classic" | "border";

export interface HudConfig {
	enabled: boolean;
	language: HudLanguageSetting;
	style: HudStyle;
	barWidth: number;
	showTools: boolean;
	maxTools: number;
	showCost: boolean;
	showElapsed: boolean;
	showCacheRate: boolean;
	showTurnDuration: boolean;
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
