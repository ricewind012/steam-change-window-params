import { definePlugin, EUIMode, IconsModule, sleep } from "@steambrew/client";

import { PLUGIN_PATH } from "./consts";
import { CLog } from "./logger";
import {
	GetParams,
	GetSettings,
	ParseParam,
	ParseParamForHTMLAttribute,
} from "./settings";
import { SettingsPanel } from "./settingspanel";
import type {
	LocalizationManager as CLocalizationManager,
	CPopupManager,
	SteamPopup,
} from "./sharedjscontextglobals/normal";

declare global {
	const g_PopupManager: CPopupManager;
	const LocalizationManager: CLocalizationManager;
}

const MAIN_WINDOW_NAME = "SP Desktop_uid0";

let g_bMainWindowWorkaroundApplied = false;
const g_pLogger = new CLog("index");

/**
 * Replacement function to avoid JSON modules because of localization - it's
 * easier to just create 1 file instead of doing the same thing, then typing an
 * import somewhere here, checking if it works, and so on.
 *
 * @param path A path that's relative to the plugin's path.
 */
async function ImportJSON(path: string) {
	return (await fetch(`${PLUGIN_PATH}/${path}`)).json();
}

async function InitLocalization() {
	const lang = await SteamClient.Settings.GetCurrentLanguage();
	const tokens = await ImportJSON(`locales/${lang}.json`).catch(() => {
		g_pLogger.Warn("No %o locale, reverting to English", lang);
		return ImportJSON(`locales/english.json`);
	});

	LocalizationManager.AddTokens(tokens);
}

/**
 * Like `CPopupManager.AddPopupCreatedCallback`, but account for existing popups
 * and is specifically for one popup.
 */
function AddPopupCreatedCallback(
	popupName: string,
	callback: (popup: SteamPopup) => void,
) {
	const popup = g_PopupManager.GetExistingPopup(popupName);
	if (popup) {
		callback(popup);
		return;
	}

	return g_PopupManager.AddPopupCreatedCallback((popup) => {
		if (popup.m_strName !== popupName) {
			return;
		}

		callback(popup);
	});
}

async function OnMainWindowCreated() {
	if (g_bMainWindowWorkaroundApplied) {
		return;
	}

	// lmfaooooooooooo
	SteamClient.UI.SetUIMode(EUIMode.GamePad);
	const store = globalThis.SteamUIStore.WindowStore;
	while (
		!store.GamepadUIMainWindowInstance?.BIsGamepadApplicationUIInitialized()
	) {
		await sleep(100);
	}
	SteamClient.UI.SetUIMode(EUIMode.Desktop);
	g_bMainWindowWorkaroundApplied = true;
}

async function OnPopupCreated(pPopup: SteamPopup) {
	const pPopupDoc = pPopup.m_popup.document;
	const params = GetParams();
	for (const [k, v] of params) {
		const elRoot = pPopupDoc.documentElement;
		const value = ParseParamForHTMLAttribute(k, v);
		elRoot.setAttribute(k, value);
	}
}

export default definePlugin(async () => {
	const params = GetParams();
	const { options } = GetSettings();

	let bStartedBeforeMainWindow =
		!g_PopupManager.GetExistingPopup(MAIN_WINDOW_NAME);

	const pOriginalOpen = window.open;
	window.open = (url, target, features) => {
		const bIsBPMWindow =
			target === "SP BPM_uid0" ||
			target.startsWith("MainMenu_") ||
			target.startsWith("QuickAccess_");
		if (bIsBPMWindow) {
			g_pLogger.Log("window.open: ignoring %o, is a BPM window", target);
			return pOriginalOpen(url, target, features);
		}

		const pNewURL = new URL(url);

		const bOverlay = target.startsWith("desktopoverlay_");
		const bOverlayAsParent =
			pNewURL.searchParams.has("pid") &&
			pNewURL.searchParams.get("pid") !== "0";
		const bDontApply = [
			options.ExcludeMenus && target.startsWith("contextmenu_"),
			options.ExcludeNotifications && target.startsWith("notificationtoasts_"),
			options.ExcludeOverlay && (bOverlay || bOverlayAsParent),
		].find(Boolean);
		if (bDontApply) {
			g_pLogger.Log("window.open: ignoring %o by preference", target);
			return pOriginalOpen(url, target, features);
		}

		for (const [k, v] of params) {
			const value = ParseParam(k, v);
			pNewURL.searchParams.set(k, value);
		}

		// Needed for ignoring main window workaround, if started early enough
		if (target === MAIN_WINDOW_NAME) {
			bStartedBeforeMainWindow = true;
		}

		return pOriginalOpen(pNewURL, target, features);
	};

	const eInitialUIMode = await SteamClient.UI.GetUIMode();
	if (
		eInitialUIMode === EUIMode.Desktop &&
		!bStartedBeforeMainWindow &&
		options.ApplyMainWindowWorkaround
	) {
		AddPopupCreatedCallback(MAIN_WINDOW_NAME, OnMainWindowCreated);
	}

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreated);
	await InitLocalization();

	return {
		content: <SettingsPanel />,
		icon: <IconsModule.SingleWindowToggle />,
		title: "test",
	};
});
