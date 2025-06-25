import {
	DialogButton,
	findAllModules,
	findModule,
	Millennium,
	pluginSelf,
	showModal,
} from "@steambrew/client";
import { render } from "react-dom";

import * as pLocales from "../locales";
import plugin from "../plugin.json";
import { CLog } from "./logger";
import { Localize } from "./modules/localization";
import {
	GetSettings,
	ParseParam,
	ParseParamForHTMLAttribute,
} from "./settings";
import { SettingsDialog } from "./settingsdialog";
import type {
	LocalizationManager as CLocalizationManager,
	CPopupManager,
	PopupCallback_t,
	SteamPopup,
} from "./sharedjscontextglobals/normal";

declare const g_PopupManager: CPopupManager;
declare const LocalizationManager: CLocalizationManager;

const g_pLogger = new CLog("index");

const strSettingsWindowTitle = Localize("#Settings_Title");
const pClassModules = {
	gamepaddialog: findAllModules((e) => e.WithBottomSeparator)[0],
	pagedsettings: findModule(
		(e) =>
			e.PagedSettingsDialog_Title && !e.PagedSettingsDialog_PageList_ShowTitle
	),
	settings: findModule((e) => e.SettingsDialogSubHeader),
};

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

/**
 * Safe version of `CPopupManager.AddPopupCreatedCallback`.
 */
function AddPopupCreatedCallback(popupName: string, callback: PopupCallback_t) {
	const popup = g_PopupManager.GetExistingPopup(popupName);
	if (popup) {
		callback(popup);
		return;
	}

	g_PopupManager.AddPopupCreatedCallback(callback);
}

async function InitLocalization() {
	const strLocale = await SteamClient.Settings.GetCurrentLanguage();
	const pTokens = pLocales[strLocale] || pLocales.english;
	if (!pLocales[strLocale]) {
		g_pLogger.Warn(
			"No localization for locale %o, reverting to English",
			strLocale
		);
	}

	LocalizationManager.AddTokens(pTokens);
}

async function OnPopupCreated(pPopup: SteamPopup) {
	const pPopupDoc = pPopup.m_popup.document;
	const { params } = await GetSettings();
	for (const [k, v] of Object.entries(params)) {
		const elRoot = pPopupDoc.documentElement;
		const value = ParseParamForHTMLAttribute(k, v);
		elRoot.setAttribute(k, value);
	}

	if (pPopup.m_strTitle !== strSettingsWindowTitle) {
		return;
	}

	await WaitForElement(
		`.${pClassModules.pagedsettings.Active}.MillenniumTab:first-child`,
		pPopupDoc
	);
	await WaitForElement(`.${pClassModules.gamepaddialog.Field}`, pPopupDoc);
	const elFieldChildren = [
		...pPopupDoc.querySelectorAll(`.${pClassModules.gamepaddialog.FieldLabel}`),
	].find((e) => e.textContent === plugin.common_name).nextElementSibling;
	const elContainer = document.createElement("div");
	elFieldChildren.prepend(elContainer);

	const strTitle = Localize("#ChangeWindowParams_Dialog_SettingsTitle");
	render(
		<DialogButton
			className={pClassModules.settings.SettingsDialogButton}
			onClick={() => {
				const pSettingsDialog = pPopup.m_popup;
				pluginSelf.pSettingsDialog = pSettingsDialog;
				showModal(<SettingsDialog />, pSettingsDialog, {
					bNeverPopOut: true,
					strTitle,
				});
			}}
		>
			{strTitle}
		</DialogButton>,
		elContainer
	);
}

export default async function PluginMain() {
	const { params } = await GetSettings();
	// TODO injects too slow lol lmao
	const pOriginalOpen = window.open;
	window.open = (url, target, features) => {
		const pNewURL = new URL(url);
		for (const [k, v] of Object.entries(params)) {
			const value = ParseParam(k, v);
			pNewURL.searchParams.set(k, value);
		}
		g_pLogger.Log("window.open %o", [pNewURL.toString(), target, features]);

		return pOriginalOpen(pNewURL, target, features);
	};

	g_pLogger.Log("Initializing localization");
	await InitLocalization();

	g_pLogger.Log("Injecting plugin options into %o", strSettingsWindowTitle);
	AddPopupCreatedCallback(strSettingsWindowTitle, OnPopupCreated);
}
