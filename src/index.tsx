import { definePlugin, IconsModule } from "@steambrew/client";

import * as pLocales from "../locales";
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

async function InitLocalization() {
	const strLocale = await SteamClient.Settings.GetCurrentLanguage();
	const pTokens = pLocales[strLocale] || pLocales.english;
	if (!pLocales[strLocale]) {
		g_pLogger.Warn(
			"No localization for locale %o, reverting to English",
			strLocale,
		);
	}

	LocalizationManager.AddTokens(pTokens);
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
