import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { HudConfig, HudLanguage } from "./types.ts";

export function fmtTokens(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0";
	if (value < 1_000) return `${Math.round(value)}`;
	if (value < 10_000) return `${(value / 1_000).toFixed(1)}k`;
	if (value < 1_000_000) return `${Math.round(value / 1_000)}k`;
	if (value < 10_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	return `${Math.round(value / 1_000_000)}M`;
}

export function fmtPercent(value: number): string {
	if (!Number.isFinite(value)) return "0%";
	return `${Math.round(value * 100)}%`;
}

export function fmtTokenRate(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0/s";
	const tokens = value < 10 ? value.toFixed(1).replace(/\.0$/, "") : fmtTokens(value);
	return `${tokens}/s`;
}

export function fmtCost(usdCost: number, config: Pick<HudConfig, "currency" | "exchangeRate">, subscription = false): string {
	const safeUsdCost = Number.isFinite(usdCost) && usdCost > 0 ? usdCost : 0;
	const amount = config.currency === "CNY" ? `¥${(safeUsdCost * config.exchangeRate).toFixed(3)}` : `$${safeUsdCost.toFixed(3)}`;
	return subscription ? `${amount} (sub)` : amount;
}

/**
 * Whether the active model is billed through a subscription rather than per token.
 * Mirrors pi's built-in footer, which also treats Kimi Coding as subscription-backed.
 */
export function isSubscriptionModel(ctx: ExtensionContext): boolean {
	const model = ctx.model;
	if (!model) return false;
	if (model.provider === "kimi-coding") return true;
	if (!ctx.modelRegistry.isUsingOAuth(model)) return false;
	return ctx.modelRegistry.getProvider(model.provider)?.auth.oauth?.isSubscription === true;
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
