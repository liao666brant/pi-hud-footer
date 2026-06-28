import { CONFIG_DIR_NAME, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HudConfig } from "./types.ts";

export const DEFAULT_CONFIG: HudConfig = {
	enabled: true,
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

function mergeConfig(base: HudConfig, patch: unknown): HudConfig {
	if (!isObject(patch)) return base;
	return {
		enabled: typeof patch.enabled === "boolean" ? patch.enabled : base.enabled,
		barWidth: clampInt(patch.barWidth, base.barWidth, 6, 40),
		showTools: typeof patch.showTools === "boolean" ? patch.showTools : base.showTools,
		maxTools: clampInt(patch.maxTools, base.maxTools, 1, 20),
		showCost: typeof patch.showCost === "boolean" ? patch.showCost : base.showCost,
		showElapsed: typeof patch.showElapsed === "boolean" ? patch.showElapsed : base.showElapsed,
		showCacheRate: typeof patch.showCacheRate === "boolean" ? patch.showCacheRate : base.showCacheRate,
		showTurnDuration: typeof patch.showTurnDuration === "boolean" ? patch.showTurnDuration : base.showTurnDuration,
	};
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

export function loadConfig(ctx: ExtensionContext): HudConfig {
	let config = { ...DEFAULT_CONFIG };
	const globalPath = join(homedir(), CONFIG_DIR_NAME, "agent", "hud-footer.json");
	config = mergeConfig(config, readJsonConfig(globalPath));

	if (ctx.isProjectTrusted()) {
		const projectPath = join(ctx.cwd, CONFIG_DIR_NAME, "hud-footer.json");
		config = mergeConfig(config, readJsonConfig(projectPath));
	}

	return config;
}
