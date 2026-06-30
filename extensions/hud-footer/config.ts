import { CONFIG_DIR_NAME, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { normalizeLanguageSetting } from "./i18n.ts";
import {
	HUD_DISPLAY_KEYS,
	HUD_DISPLAY_SCOPES,
	type HudConfig,
	type HudDisplayConfig,
	type HudDisplayKey,
	type HudStyle,
} from "./types.ts";

const CONFIG_FILE_NAME = "hud-footer.json";

const STYLE_ALIASES: Record<string, HudStyle> = {
	"1": "classic",
	classic: "classic",
	footer: "classic",
	legacy: "classic",
	default: "classic",
	"2": "border",
	border: "border",
	editor: "border",
	compact: "border",
	current: "border",
};

const LEGACY_DISPLAY_KEYS = {
	showTools: "toolsLine",
	showCacheRate: "cacheRate",
	showElapsed: "elapsed",
	showCost: "cost",
	showTurnDuration: "turnDuration",
} as const satisfies Record<string, HudDisplayKey>;

export const DEFAULT_CONFIG: HudConfig = {
	enabled: true,
	language: "auto",
	style: "classic",
	display: {},
	barWidth: 18,
	maxTools: 7,
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.round(value)));
}

function mergeLanguage(base: HudConfig, patch: Record<string, unknown>): HudConfig["language"] {
	if (!Object.hasOwn(patch, "language")) return base.language;
	return normalizeLanguageSetting(patch.language) ?? "en";
}

function mergeDisplay(base: HudDisplayConfig, patch: Record<string, unknown>): HudDisplayConfig {
	const next: HudDisplayConfig = {};
	for (const scope of HUD_DISPLAY_SCOPES) {
		if (base[scope]) next[scope] = { ...base[scope] };
	}

	for (const [legacyKey, displayKey] of Object.entries(LEGACY_DISPLAY_KEYS)) {
		const value = patch[legacyKey];
		if (typeof value === "boolean") next.all = { ...next.all, [displayKey]: value };
	}

	const display = patch.display;
	for (const scope of HUD_DISPLAY_SCOPES) {
		const patchScope = isObject(display) ? display[scope] : undefined;
		if (!isObject(patchScope)) continue;
		next[scope] = { ...next[scope] };
		for (const key of HUD_DISPLAY_KEYS) {
			if (typeof patchScope[key] === "boolean") next[scope][key] = patchScope[key];
		}
	}
	return next;
}

export function normalizeStyle(value: unknown): HudStyle | undefined {
	if (typeof value === "number") return STYLE_ALIASES[String(value)];
	if (typeof value !== "string") return undefined;
	return STYLE_ALIASES[value.trim().toLowerCase()];
}

function mergeConfig(base: HudConfig, patch: unknown): HudConfig {
	if (!isObject(patch)) return base;
	return {
		enabled: typeof patch.enabled === "boolean" ? patch.enabled : base.enabled,
		language: mergeLanguage(base, patch),
		style: normalizeStyle(patch.style) ?? base.style,
		display: mergeDisplay(base.display, patch),
		barWidth: clampInt(patch.barWidth, base.barWidth, 6, 40),
		maxTools: clampInt(patch.maxTools, base.maxTools, 1, 20),
	};
}

export function isDisplayEnabled(config: HudConfig, key: HudDisplayKey): boolean {
	let enabled = true;
	const all = config.display.all?.[key];
	const themed = config.display[config.style]?.[key];
	if (typeof all === "boolean") enabled = all;
	if (typeof themed === "boolean") enabled = themed;
	return enabled;
}

function globalConfigPath(): string {
	return join(homedir(), CONFIG_DIR_NAME, "agent", CONFIG_FILE_NAME);
}

function projectConfigPath(ctx: ExtensionContext): string {
	return join(ctx.cwd, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
}

function styleConfigPath(ctx: ExtensionContext): string {
	const projectPath = projectConfigPath(ctx);
	if (ctx.isProjectTrusted() && existsSync(projectPath)) return projectPath;
	return globalConfigPath();
}

function readJsonConfig(path: string): unknown {
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		console.error(`[pi-hud-footer] Failed to read config ${path}:`, error);
		return undefined;
	}
}

function readJsonObject(path: string): Record<string, unknown> {
	const config = readJsonConfig(path);
	return isObject(config) ? config : {};
}

export function saveConfigStyle(ctx: ExtensionContext, style: HudStyle): string {
	const path = styleConfigPath(ctx);
	const nextConfig = { ...readJsonObject(path), style };
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
	return path;
}

export function loadConfig(ctx: ExtensionContext): HudConfig {
	let config = { ...DEFAULT_CONFIG };
	config = mergeConfig(config, readJsonConfig(globalConfigPath()));

	if (ctx.isProjectTrusted()) {
		config = mergeConfig(config, readJsonConfig(projectConfigPath(ctx)));
	}

	return config;
}
