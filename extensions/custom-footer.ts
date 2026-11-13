import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_CONFIG, isDisplayEnabled, loadConfig, normalizeCurrency, normalizeStyle, saveConfig } from "./hud-footer/config.ts";
import { createHudEditorFactory } from "./hud-footer/editor.ts";
import { fmtTurnDuration } from "./hud-footer/format.ts";
import { getI18n, normalizeLanguageSetting } from "./hud-footer/i18n.ts";
import { createHudFooter, type HudEditorState } from "./hud-footer/render.ts";
import { createTokenRateTracker } from "./hud-footer/token-rate.ts";
import { HUD_CURRENCIES, type HudConfig, type HudCurrency, type HudLanguageSetting, type HudStyle } from "./hud-footer/types.ts";

const ACTIVE_EXTENSION_KEY = Symbol.for("pi-hud-footer.active");
type HudGlobal = typeof globalThis & { [ACTIVE_EXTENSION_KEY]?: boolean };
const LANGUAGE_SETTINGS: HudLanguageSetting[] = ["auto", "zh", "en"];

export default function (pi: ExtensionAPI) {
	const hudGlobal = globalThis as HudGlobal;
	if (hudGlobal[ACTIVE_EXTENSION_KEY]) return;
	hudGlobal[ACTIVE_EXTENSION_KEY] = true;

	let runtimeEnabled: boolean | undefined;
	let running = false;
	let uiPromptActive = false;
	let agentStartedAt: number | undefined;
	const tokenRateTracker = createTokenRateTracker();
	let lastTurnDuration: number | undefined;
	let runningTimer: ReturnType<typeof setInterval> | undefined;
	let config: HudConfig = { ...DEFAULT_CONFIG };
	let editorInstalled = false;
	let previousEditorFactory: ReturnType<ExtensionContext["ui"]["getEditorComponent"]> | undefined;
	const editorState: HudEditorState = {};
	const commandI18n = getI18n(DEFAULT_CONFIG.language);

	function currentI18n() {
		return getI18n(config.language);
	}

	function isEnabled(): boolean {
		return runtimeEnabled ?? config.enabled;
	}

	function isRunning(): boolean {
		return running && !uiPromptActive;
	}

	function getLastTurnDuration(): number | undefined {
		return lastTurnDuration;
	}

	function getLastTokenRate(): number | undefined {
		return tokenRateTracker.rate;
	}

	function resetTokenRate() {
		tokenRateTracker.reset();
	}

	function deltaText(update: unknown): string | undefined {
		if (typeof update !== "object" || update === null || !("delta" in update)) return undefined;
		const delta = (update as { delta?: unknown }).delta;
		return typeof delta === "string" ? delta : undefined;
	}

	function updateRunningMessage(ctx: ExtensionContext) {
		if (agentStartedAt === undefined || uiPromptActive) return;
		const i18n = currentI18n();
		const elapsed = fmtTurnDuration(Date.now() - agentStartedAt, i18n.language);
		ctx.ui.setWorkingMessage(i18n.workingMessage(elapsed));
	}

	function stopRunningTimer(ctx?: ExtensionContext) {
		if (runningTimer) {
			clearInterval(runningTimer);
			runningTimer = undefined;
		}
		ctx?.ui.setWorkingMessage();
	}

	function pauseForUiPrompt(ctx: ExtensionContext) {
		uiPromptActive = true;
		if (ctx.mode === "tui") ctx.ui.setWorkingMessage();
	}

	function resumeAfterUiPrompt(ctx: ExtensionContext) {
		uiPromptActive = false;
		if (running && ctx.mode === "tui" && isDisplayEnabled(config, "turnDuration")) {
			updateRunningMessage(ctx);
		}
	}

	function startRunningTimer(ctx: ExtensionContext) {
		stopRunningTimer();
		if (!isDisplayEnabled(config, "turnDuration") || ctx.mode !== "tui") return;
		updateRunningMessage(ctx);
		runningTimer = setInterval(() => updateRunningMessage(ctx), 1000);
	}

	function installEditor(ctx: ExtensionContext) {
		if (ctx.mode !== "tui") return;
		if (!editorInstalled) previousEditorFactory = ctx.ui.getEditorComponent();
		ctx.ui.setEditorComponent(
			createHudEditorFactory(
				pi,
				ctx,
				config,
				isRunning,
				getLastTurnDuration,
				getLastTokenRate,
				editorState,
			),
		);
		editorInstalled = true;
	}

	function uninstallEditor(ctx: ExtensionContext) {
		if (!editorInstalled || ctx.mode !== "tui") return;
		ctx.ui.setEditorComponent(previousEditorFactory);
		previousEditorFactory = undefined;
		editorInstalled = false;
	}

	function clearHud(ctx: ExtensionContext) {
		ctx.ui.setFooter(undefined);
		uninstallEditor(ctx);
	}

	function applyHud(ctx: ExtensionContext) {
		config = loadConfig(ctx);

		if (!isEnabled()) {
			clearHud(ctx);
			return;
		}

		if (config.style === "border") installEditor(ctx);
		else uninstallEditor(ctx);
		ctx.ui.setFooter(
			createHudFooter(
				pi,
				ctx,
				config,
				isRunning,
				getLastTurnDuration,
				getLastTokenRate,
				editorState,
			),
		);
	}

	function styleOptions(i18n = currentI18n()): string[] {
		return [`1 - ${i18n.styleNames.classic}`, `2 - ${i18n.styleNames.border}`];
	}

	function languageOptions(i18n = currentI18n()): string[] {
		return LANGUAGE_SETTINGS.map((setting, index) => `${index + 1} - ${i18n.languageNames[setting]}`);
	}

	function currencyOptions(i18n = currentI18n()): string[] {
		return HUD_CURRENCIES.map((currency, index) => `${index + 1} - ${i18n.currencyNames[currency]}`);
	}

	function parseStyleChoice(value: string | undefined): HudStyle | undefined {
		if (!value) return undefined;
		const trimmed = value.trim();
		if (trimmed.startsWith("1 -")) return "classic";
		if (trimmed.startsWith("2 -")) return "border";
		return normalizeStyle(trimmed);
	}

	async function chooseStyle(args: string, ctx: ExtensionContext): Promise<HudStyle | undefined> {
		const trimmedArgs = args.trim();
		const fromArgs = parseStyleChoice(trimmedArgs);
		if (fromArgs) return fromArgs;
		if (trimmedArgs) return undefined;
		if (ctx.mode === "tui") {
			const selected = await ctx.ui.select(currentI18n().styleSelectTitle, styleOptions());
			return parseStyleChoice(selected);
		}
		return config.style === "classic" ? "border" : "classic";
	}

	function parseLanguageChoice(value: string | undefined): HudLanguageSetting | undefined {
		if (!value) return undefined;
		const trimmed = value.trim();
		const rank = /^(\d+)(?: -.+)?$/.exec(trimmed);
		if (rank) return LANGUAGE_SETTINGS[Number(rank[1]) - 1];
		return normalizeLanguageSetting(trimmed);
	}

	async function chooseLanguage(args: string, ctx: ExtensionContext): Promise<HudLanguageSetting | undefined> {
		const trimmedArgs = args.trim();
		const fromArgs = parseLanguageChoice(trimmedArgs);
		if (fromArgs) return fromArgs;
		if (trimmedArgs) return undefined;
		if (ctx.mode === "tui") {
			const selected = await ctx.ui.select(currentI18n().languageSelectTitle, languageOptions());
			return parseLanguageChoice(selected);
		}
		const index = LANGUAGE_SETTINGS.indexOf(config.language);
		return LANGUAGE_SETTINGS[(index + 1) % LANGUAGE_SETTINGS.length];
	}

	function parseCurrencyChoice(value: string | undefined): HudCurrency | undefined {
		if (!value) return undefined;
		const trimmed = value.trim();
		const rank = /^(\d+)(?: -.+)?$/.exec(trimmed);
		if (rank) return HUD_CURRENCIES[Number(rank[1]) - 1];
		return normalizeCurrency(trimmed);
	}

	async function chooseCurrency(args: string, ctx: ExtensionContext): Promise<HudCurrency | undefined> {
		const trimmedArgs = args.trim();
		const fromArgs = parseCurrencyChoice(trimmedArgs);
		if (fromArgs) return fromArgs;
		if (trimmedArgs) return undefined;
		if (ctx.mode === "tui") {
			const selected = await ctx.ui.select(currentI18n().currencySelectTitle, currencyOptions());
			return parseCurrencyChoice(selected);
		}
		const index = HUD_CURRENCIES.indexOf(config.currency);
		return HUD_CURRENCIES[(index + 1) % HUD_CURRENCIES.length];
	}

	pi.on("session_start", (_event, ctx) => {
		resetTokenRate();
		applyHud(ctx);
	});

	pi.on("agent_start", (_event, ctx) => {
		running = true;
		uiPromptActive = false;
		agentStartedAt = Date.now();
		startRunningTimer(ctx);
	});

	pi.on("ui_prompt_start", (_event, ctx) => {
		pauseForUiPrompt(ctx);
	});

	pi.on("ui_prompt_end", (_event, ctx) => {
		resumeAfterUiPrompt(ctx);
	});

	pi.on("turn_start", () => {
		resetTokenRate();
	});

	pi.on("message_start", (event) => {
		if (event.message.role !== "assistant") return;
		tokenRateTracker.beginMessage();
	});

	pi.on("message_update", (event) => {
		if (event.message.role !== "assistant") return;
		const delta = deltaText(event.assistantMessageEvent);
		if (delta === undefined) return;
		tokenRateTracker.addDelta(delta);
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant") return;
		tokenRateTracker.finish(event.message);
	});

	pi.on("agent_end", (_event, ctx) => {
		running = false;
		uiPromptActive = false;
		const elapsed = agentStartedAt === undefined ? undefined : Date.now() - agentStartedAt;
		if (elapsed !== undefined) lastTurnDuration = elapsed;
		agentStartedAt = undefined;
		stopRunningTimer(ctx);
		if (isDisplayEnabled(config, "turnDuration") && elapsed !== undefined && ctx.hasUI) {
			const i18n = currentI18n();
			const turnDuration = fmtTurnDuration(elapsed, i18n.language);
			ctx.ui.notify(i18n.turnDurationNotification(turnDuration), "info");
		}
	});

	pi.on("session_shutdown", (_event, ctx) => {
		stopRunningTimer(ctx);
		uninstallEditor(ctx);
		delete hudGlobal[ACTIVE_EXTENSION_KEY];
	});

	pi.registerCommand("hud-footer", {
		description: commandI18n.commands.toggleDescription,
		handler: async (_args, ctx) => {
			runtimeEnabled = !isEnabled();
			if (runtimeEnabled) {
				applyHud(ctx);
				ctx.ui.notify(currentI18n().footerEnabled, "info");
				return;
			}

			clearHud(ctx);
			ctx.ui.notify(currentI18n().footerDisabled, "info");
		},
	});

	pi.registerCommand("hud-footer-reload", {
		description: commandI18n.commands.reloadDescription,
		handler: async (_args, ctx) => {
			applyHud(ctx);
			ctx.ui.notify(currentI18n().configReloaded, "info");
		},
	});

	async function handleThemeCommand(args: string, ctx: ExtensionContext) {
		const nextStyle = await chooseStyle(args, ctx);
		if (!nextStyle) {
			ctx.ui.notify(currentI18n().commands.styleDescription, "warning");
			return;
		}

		try {
			saveConfig(ctx, { style: nextStyle });
		} catch (error) {
			console.error("[pi-hud-footer] Failed to save style:", error);
			ctx.ui.notify(currentI18n().styleSaveFailed, "error");
			return;
		}

		applyHud(ctx);
		ctx.ui.notify(currentI18n().styleSaved(currentI18n().styleNames[nextStyle]), "info");
	}

	async function handleLanguageCommand(args: string, ctx: ExtensionContext) {
		const nextLanguage = await chooseLanguage(args, ctx);
		if (!nextLanguage) {
			ctx.ui.notify(currentI18n().commands.languageDescription, "warning");
			return;
		}

		try {
			saveConfig(ctx, { language: nextLanguage });
		} catch (error) {
			console.error("[pi-hud-footer] Failed to save language:", error);
			ctx.ui.notify(currentI18n().languageSaveFailed, "error");
			return;
		}

		applyHud(ctx);
		ctx.ui.notify(currentI18n().languageSaved(currentI18n().languageNames[nextLanguage]), "info");
	}

	pi.registerCommand("hud-footer-theme", {
		description: commandI18n.commands.styleDescription,
		handler: handleThemeCommand,
	});

	pi.registerCommand("hud-footer-language", {
		description: commandI18n.commands.languageDescription,
		handler: handleLanguageCommand,
	});

	async function handleCurrencyCommand(args: string, ctx: ExtensionContext) {
		const nextCurrency = await chooseCurrency(args, ctx);
		if (!nextCurrency) {
			ctx.ui.notify(currentI18n().commands.currencyDescription, "warning");
			return;
		}

		try {
			saveConfig(ctx, { currency: nextCurrency });
		} catch (error) {
			console.error("[pi-hud-footer] Failed to save currency:", error);
			ctx.ui.notify(currentI18n().currencySaveFailed, "error");
			return;
		}

		applyHud(ctx);
		ctx.ui.notify(currentI18n().currencySaved(currentI18n().currencyNames[nextCurrency]), "info");
	}

	pi.registerCommand("hud-footer-currency", {
		description: commandI18n.commands.currencyDescription,
		handler: handleCurrencyCommand,
	});
}
