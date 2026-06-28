import type { HudLanguage, HudLanguageSetting } from "./types.ts";

type FooterLabels = {
	ready: string;
	running: string;
	tokens: string;
	cacheRate: string;
	elapsed: string;
	cost: string;
	tokenBreakdown(input: string, output: string, cacheRead: string, cacheWrite: string): string;
};

type HudMessages = {
	language: HudLanguage;
	labels: FooterLabels;
	workingMessage(turnDuration: string): string;
	turnDurationNotification(turnDuration: string): string;
	footerEnabled: string;
	footerDisabled: string;
	configReloaded: string;
	commands: {
		toggleDescription: string;
		reloadDescription: string;
	};
};

const TRANSLATIONS: Record<HudLanguage, Omit<HudMessages, "language">> = {
	en: {
		labels: {
			ready: "✓ ready",
			running: "● running",
			tokens: "Tokens:",
			cacheRate: "cache hit",
			elapsed: "elapsed",
			cost: "cost",
			tokenBreakdown: (input, output, cacheRead, cacheWrite) =>
				`(in ${input} / out ${output} / cache R${cacheRead} W${cacheWrite})`,
		},
		workingMessage: (turnDuration) => `Running · this turn ${turnDuration}`,
		turnDurationNotification: (turnDuration) => `Turn duration ${turnDuration}`,
		footerEnabled: "HUD footer enabled",
		footerDisabled: "HUD footer disabled",
		configReloaded: "HUD footer config reloaded",
		commands: {
			toggleDescription: "Toggle Claude HUD style custom footer.",
			reloadDescription: "Reload pi-hud-footer config.",
		},
	},
	zh: {
		labels: {
			ready: "✓ 就绪",
			running: "● 运行中",
			tokens: "词元:",
			cacheRate: "缓存率",
			elapsed: "耗时",
			cost: "费用",
			tokenBreakdown: (input, output, cacheRead, cacheWrite) =>
				`(输入 ${input} / 输出 ${output} / 缓存 R${cacheRead} W${cacheWrite})`,
		},
		workingMessage: (turnDuration) => `运行中 · 本轮用时 ${turnDuration}`,
		turnDurationNotification: (turnDuration) => `本轮用时 ${turnDuration}`,
		footerEnabled: "HUD footer 已启用",
		footerDisabled: "HUD footer 已禁用",
		configReloaded: "HUD footer 配置已重新加载",
		commands: {
			toggleDescription: "切换 Claude HUD 风格自定义 footer。",
			reloadDescription: "重新加载 pi-hud-footer 配置。",
		},
	},
};

function cleanLocale(value: string): string {
	return value.trim().replace(/_/g, "-").split(".")[0].toLowerCase();
}

function languageFromLocale(value: unknown): HudLanguage | undefined {
	if (typeof value !== "string") return undefined;
	const locale = cleanLocale(value);
	if (!locale || locale === "c" || locale === "posix") return undefined;

	const primary = locale.split("-")[0];
	if (
		primary === "zh" ||
		locale === "cn" ||
		locale === "chs" ||
		locale === "cht" ||
		locale.includes("chinese") ||
		locale.includes("中文")
	) {
		return "zh";
	}
	if (primary === "en" || locale.includes("english")) return "en";
	return undefined;
}

function localeCandidates(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(":")
		.map((part) => part.trim())
		.filter(Boolean);
}

export function normalizeLanguageSetting(value: unknown): HudLanguageSetting | undefined {
	if (typeof value !== "string") return undefined;
	const locale = cleanLocale(value);
	if (!locale) return undefined;
	if (locale === "auto" || locale === "system" || locale === "default") return "auto";
	return languageFromLocale(locale);
}

export function detectSystemLanguage(): HudLanguage {
	const candidates = [
		...localeCandidates(process.env.LANGUAGE),
		...localeCandidates(process.env.LC_ALL),
		...localeCandidates(process.env.LC_MESSAGES),
		...localeCandidates(process.env.LANG),
	];

	try {
		candidates.push(Intl.DateTimeFormat().resolvedOptions().locale);
	} catch {
		// Ignore Intl failures and fall back to English below.
	}

	for (const candidate of candidates) {
		const language = languageFromLocale(candidate);
		if (language) return language;
	}

	return "en";
}

export function resolveLanguage(setting: HudLanguageSetting): HudLanguage {
	return setting === "auto" ? detectSystemLanguage() : setting;
}

export function getI18n(setting: HudLanguageSetting): HudMessages {
	const language = resolveLanguage(setting);
	return { language, ...TRANSLATIONS[language] };
}
