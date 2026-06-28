import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { HudLanguage } from "./types.ts";

export function fmtTokens(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0";
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
	return `${Math.round(value)}`;
}

export function fmtPercent(value: number): string {
	if (!Number.isFinite(value)) return "0%";
	return `${Math.round(value * 100)}%`;
}

export function fmtDuration(ms: number, language: HudLanguage = "en"): string {
	if (!Number.isFinite(ms) || ms < 0) {
		return language === "zh" ? "0分" : "0m";
	}

	const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (language === "zh") {
		if (hours > 0) return `${hours}小时 ${minutes}分`;
		return `${minutes}分`;
	}

	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

export function fmtTurnDuration(ms: number, language: HudLanguage = "en"): string {
	if (!Number.isFinite(ms) || ms < 0) return language === "zh" ? "0秒" : "0s";
	if (ms < 1000) return language === "zh" ? "<1秒" : "<1s";
	const totalSeconds = Math.round(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (language === "zh") {
		if (hours > 0) return `${hours}小时${minutes}分${seconds}秒`;
		if (minutes > 0) return `${minutes}分${seconds}秒`;
		return `${seconds}秒`;
	}
	if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

export function shortModel(ctx: ExtensionContext): string {
	const id = ctx.model?.id ?? "no-model";
	return id
		.replace(/^claude-/, "")
		.replace(/^gpt-/, "gpt-")
		.replace(/-20\d{6}$/, "")
		.replace(/-latest$/, "");
}
