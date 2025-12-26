import { definePlugin, IconsModule } from "@steambrew/client";

import { PLUGIN_PATH } from "./consts";
import { CLog } from "./logger";
import { GetParams, ParseParam, ParseParamForHTMLAttribute } from "./settings";
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
	// TODO injects too slow lol lmao
	const pOriginalOpen = window.open;
	window.open = (url, target, features) => {
		const pNewURL = new URL(url);
		for (const [k, v] of params) {
			const value = ParseParam(k, v);
			pNewURL.searchParams.set(k, value);
		}
		g_pLogger.Log("window.open %o", [pNewURL.toString(), target, features]);

		return pOriginalOpen(pNewURL, target, features);
	};

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreated);
	await InitLocalization();

	return {
		content: <SettingsPanel />,
		icon: <IconsModule.Settings />,
		title: "test",
	};
});
