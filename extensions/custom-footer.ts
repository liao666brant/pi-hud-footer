import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_CONFIG, loadConfig } from "./hud-footer/config.ts";
import { fmtTurnDuration } from "./hud-footer/format.ts";
import { createHudFooter } from "./hud-footer/render.ts";
import type { HudConfig } from "./hud-footer/types.ts";

export default function (pi: ExtensionAPI) {
	let runtimeEnabled: boolean | undefined;
	let running = false;
	let agentStartedAt: number | undefined;
	let lastTurnDuration: number | undefined;
	let runningTimer: ReturnType<typeof setInterval> | undefined;
	let config: HudConfig = { ...DEFAULT_CONFIG };

	function isEnabled(): boolean {
		return runtimeEnabled ?? config.enabled;
	}

	function updateRunningMessage(ctx: ExtensionContext) {
		if (agentStartedAt === undefined) return;
		ctx.ui.setWorkingMessage(`运行中 · 本轮用时 ${fmtTurnDuration(Date.now() - agentStartedAt)}`);
	}

	function stopRunningTimer(ctx?: ExtensionContext) {
		if (runningTimer) {
			clearInterval(runningTimer);
			runningTimer = undefined;
		}
		ctx?.ui.setWorkingMessage();
	}

	function startRunningTimer(ctx: ExtensionContext) {
		stopRunningTimer();
		if (!config.showTurnDuration || ctx.mode !== "tui") return;
		updateRunningMessage(ctx);
		runningTimer = setInterval(() => updateRunningMessage(ctx), 1000);
	}

	function installFooter(ctx: ExtensionContext) {
		config = loadConfig(ctx);

		if (!isEnabled()) {
			ctx.ui.setFooter(undefined);
			return;
		}

		ctx.ui.setFooter(createHudFooter(pi, ctx, config, () => running, () => lastTurnDuration));
	}

	pi.on("session_start", (_event, ctx) => {
		installFooter(ctx);
	});

	pi.on("agent_start", (_event, ctx) => {
		running = true;
		agentStartedAt = Date.now();
		startRunningTimer(ctx);
	});

	pi.on("agent_end", (_event, ctx) => {
		running = false;
		const elapsed = agentStartedAt === undefined ? undefined : Date.now() - agentStartedAt;
		if (elapsed !== undefined) lastTurnDuration = elapsed;
		agentStartedAt = undefined;
		stopRunningTimer(ctx);
		if (config.showTurnDuration && elapsed !== undefined && ctx.hasUI) {
			ctx.ui.notify(`本轮用时 ${fmtTurnDuration(elapsed)}`, "info");
		}
	});

	pi.on("session_shutdown", (_event, ctx) => {
		stopRunningTimer(ctx);
	});

	pi.registerCommand("hud-footer", {
		description: "Toggle claude-hud style custom footer.",
		handler: async (_args, ctx) => {
			runtimeEnabled = !isEnabled();
			if (runtimeEnabled) {
				installFooter(ctx);
				ctx.ui.notify("HUD footer enabled", "info");
			} else {
				ctx.ui.setFooter(undefined);
				ctx.ui.notify("HUD footer disabled", "info");
			}
		},
	});

	pi.registerCommand("hud-footer-reload", {
		description: "Reload pi-hud-footer config.",
		handler: async (_args, ctx) => {
			installFooter(ctx);
			ctx.ui.notify("HUD footer config reloaded", "info");
		},
	});
}
