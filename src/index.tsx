import { definePlugin, IconsModule } from "@steambrew/client";

import * as pLocales from "../locales";
import { CLog } from "./logger";
import {
	GetSettings,
	ParseParam,
	ParseParamForHTMLAttribute,
	type WindowParamValue_t,
} from "./settings";
import { SettingsPanel } from "./settingspanel";
import type {
	LocalizationManager as CLocalizationManager,
	CPopupManager,
	SteamPopup,
} from "./sharedjscontextglobals/normal";
import type { WindowParam_t, WindowParamMap_t } from "./types";

declare const g_PopupManager: CPopupManager;
declare const LocalizationManager: CLocalizationManager;

const g_pLogger = new CLog("index");

/**
 * because typescript sucks
 */
const GetTypedParams = (params: WindowParamMap_t<WindowParamValue_t>) =>
	Object.entries(params) as [WindowParam_t, WindowParamValue_t][];

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
	const { params } = await GetSettings();
	for (const [k, v] of GetTypedParams(params)) {
		const elRoot = pPopupDoc.documentElement;
		const value = ParseParamForHTMLAttribute(k, v);
		elRoot.setAttribute(k, value);
	}
}

export default definePlugin(async () => {
	const { params } = await GetSettings();
	// TODO injects too slow lol lmao
	const pOriginalOpen = window.open;
	window.open = (url, target, features) => {
		const pNewURL = new URL(url);
		for (const [k, v] of GetTypedParams(params)) {
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
