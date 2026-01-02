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

declare global {
	// biome-ignore lint/suspicious/noExplicitAny: XD
	const g_PopupManager: any;
	// biome-ignore lint/suspicious/noExplicitAny: XD
	const LocalizationManager: any;
	// biome-ignore lint/suspicious/noExplicitAny: XD
	const SteamUIStore: any;
}

type SteamPopup = {
	GetName(): string;
	browser_info?: {
		m_unPID: number;
		m_nBrowserID: number;
		m_eBrowserType: number;
		m_eUIMode: EUIMode;
	};
	window: Window;
};
type Unsubscribable = {
	Unsubscribe: () => void;
};

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
	const store = SteamUIStore.WindowStore;
	// wait for init, as navigator may be undefined upon switching to desktop
	while (
		!store.GamepadUIMainWindowInstance?.BIsGamepadApplicationUIInitialized()
	) {
		await sleep(100);
	}
	SteamClient.UI.SetUIMode(EUIMode.Desktop);
	g_bMainWindowWorkaroundApplied = true;
}

async function OnPopupCreated(pPopup: SteamPopup) {
	const params = GetParams();
	const { options } = GetSettings();

	const strName = pPopup.GetName();
	const pBrowser = pPopup.browser_info;

	const bOverlay = strName.startsWith("desktopoverlay_");
	const bOverlayAsParent = pBrowser && pBrowser.m_unPID !== 0;
	const bDontApply = [
		options.ExcludeMenus && strName.startsWith("contextmenu_"),
		options.ExcludeNotifications && strName.startsWith("notificationtoasts_"),
		options.ExcludeOverlay && (bOverlay || bOverlayAsParent),
	].find(Boolean);
	if (bDontApply) {
		return;
	}

	const elRoot = pPopup.window.document.documentElement;
	for (const [k, v] of params) {
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
			pNewURL.searchParams.set(k, value.toString());
		}

		// Needed for ignoring main window workaround, if started early enough
		if (target === MAIN_WINDOW_NAME) {
			bStartedBeforeMainWindow = true;
		}

		return pOriginalOpen(pNewURL, target, features);
	};

	const eInitialUIMode = await SteamClient.UI.GetUIMode();
	const vecHandles: Unsubscribable[] = [
		eInitialUIMode === EUIMode.Desktop &&
			!bStartedBeforeMainWindow &&
			options.ApplyMainWindowWorkaround &&
			AddPopupCreatedCallback(MAIN_WINDOW_NAME, OnMainWindowCreated),
		g_PopupManager.AddPopupCreatedCallback(OnPopupCreated),
	].filter(Boolean);

	function onDismount() {
		window.open = pOriginalOpen;
		for (const handle of vecHandles) {
			handle.Unsubscribe();
		}
	}

	await InitLocalization();

	return {
		content: <SettingsPanel />,
		icon: <IconsModule.SingleWindowToggle />,
		onDismount,
		title: "Change Window Params",
	};
});
