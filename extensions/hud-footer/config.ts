import { CONFIG_DIR_NAME, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { normalizeLanguageSetting } from "./i18n.ts";
import type { HudConfig, HudStyle } from "./types.ts";

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

export const DEFAULT_CONFIG: HudConfig = {
	enabled: true,
	language: "auto",
	style: "classic",
	barWidth: 18,
	showTools: true,
	maxTools: 7,
	showCost: true,
	showElapsed: true,
	showCacheRate: true,
	showTurnDuration: true,
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.round(value)));
}

function booleanOption(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function mergeLanguage(base: HudConfig, patch: Record<string, unknown>): HudConfig["language"] {
	if (!Object.hasOwn(patch, "language")) return base.language;
	return normalizeLanguageSetting(patch.language) ?? "en";
}

export function normalizeStyle(value: unknown): HudStyle | undefined {
	if (typeof value === "number") return STYLE_ALIASES[String(value)];
	if (typeof value !== "string") return undefined;
	return STYLE_ALIASES[value.trim().toLowerCase()];
}

function mergeConfig(base: HudConfig, patch: unknown): HudConfig {
	if (!isObject(patch)) return base;
	return {
		enabled: booleanOption(patch.enabled, base.enabled),
		language: mergeLanguage(base, patch),
		style: normalizeStyle(patch.style) ?? base.style,
		barWidth: clampInt(patch.barWidth, base.barWidth, 6, 40),
		showTools: booleanOption(patch.showTools, base.showTools),
		maxTools: clampInt(patch.maxTools, base.maxTools, 1, 20),
		showCost: booleanOption(patch.showCost, base.showCost),
		showElapsed: booleanOption(patch.showElapsed, base.showElapsed),
		showCacheRate: booleanOption(patch.showCacheRate, base.showCacheRate),
		showTurnDuration: booleanOption(patch.showTurnDuration, base.showTurnDuration),
	};
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
