import { definePlugin, IconsModule } from "@steambrew/client";

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

async function OnPopupCreated(pPopup: SteamPopup) {
	const pPopupDoc = pPopup.m_popup.document;
	const params = await GetParams();
	for (const [k, v] of params) {
		const elRoot = pPopupDoc.documentElement;
		const value = ParseParamForHTMLAttribute(k, v);
		elRoot.setAttribute(k, value);
	}
}

export default definePlugin(async () => {
	const params = await GetParams();
	const { options } = await GetSettings();

	// TODO injects too slow lol lmao
	const pOriginalOpen = window.open;
	window.open = (url, target, features) => {
		const bIsBPMWindow =
			target === "SP BPM_uid0" ||
			target.startsWith("MainMenu_") ||
			target.startsWith("QuickAccess_");
		if (bIsBPMWindow) {
			g_pLogger.Log("window.open: ignoring %o, is a BPM Window", target);
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

		return pOriginalOpen(pNewURL, target, features);
	};

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreated);
	await InitLocalization();

	return {
		content: <SettingsPanel />,
		icon: <IconsModule.SingleWindowToggle />,
		title: "test",
	};
});
