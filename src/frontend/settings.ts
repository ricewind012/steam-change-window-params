import { findModuleByExport, pluginConfig } from "millennium";

import { PLUGIN_NAME } from "@/consts";
import {
	EBrowserType,
	EPopupCreationFlags,
	type WindowParam_t,
	type WindowParamMap_t,
} from "@/types";

export type GetParamsResult_t = [WindowParam_t, WindowParamValue_t][];

/**
 * `number[]` - flags,
 * `string | boolean` - everything else.
 */
export type WindowParamValue_t = number[] | string | boolean;

export interface Settings {
	options: {
		ApplyMainWindowWorkaround?: boolean;
		IncludeMenus?: boolean;
		IncludeNotifications?: boolean;
		IncludeOverlay?: boolean;
		SystemTitlebar?: boolean;
		TransparentWindow?: boolean;
		NoSizeLimit?: boolean;
	};
	params: WindowParamMap_t<WindowParamValue_t>;
	simpleParams: WindowParamMap_t<WindowParamValue_t>;
}

const DEFAULT_SETTINGS: Settings = {
	options: {},
	params: {},
	simpleParams: {},
};
const SEPARATOR = "-";

// biome-ignore lint/suspicious/noExplicitAny: Intentional
export const mapParamEnums: WindowParamMap_t<any> = {
	browserType: EBrowserType,
	vrOverlayKey: Object.values(
		findModuleByExport((m) => m === "valve.steam.gamepadui.main"),
	) as string[],
};

// biome-ignore lint/suspicious/noExplicitAny: Intentional
export const mapParamFlags: WindowParamMap_t<any> = {
	createflags: EPopupCreationFlags,
};

export function BuildSettingsKey<
	F extends keyof Settings,
	K extends Exclude<keyof Settings[F], symbol>,
>(field: F, key: K) {
	return `${field}${SEPARATOR}${key}`;
}

/**
 * Gets params from settings, prioritizing `simpleParams` over `params`, since
 * they're not compatible.
 */
export async function GetParams() {
	const { params, simpleParams } = await GetSettings();
	const bUseSimpleParams = Object.keys(simpleParams).length !== 0;
	const pResult = bUseSimpleParams ? simpleParams : params;

	return Object.entries(pResult) as GetParamsResult_t;
}

// #region
// These all return `true`, because `strField` validation is done in
// settingspanel.tsx already, so these only serve to satisfy TypeScript
function isOptionKey(key: string): key is keyof Settings["options"] {
	return true;
}

function isWindowParam(key: string): key is WindowParam_t {
	return true;
}

function isWindowParamValue(value: unknown): value is WindowParamValue_t {
	return true;
}
// #endregion

export async function GetSettings() {
	const pSettings = await pluginConfig.getAll<Record<string, unknown>>();
	const pResult = DEFAULT_SETTINGS;
	// Holy shit fuck typescript
	for (const [k, v] of Object.entries(pSettings)) {
		const nSepIdx = k.indexOf(SEPARATOR);
		if (nSepIdx === -1) {
			continue;
		}

		const strField = k.slice(0, nSepIdx);
		const strKey = k.slice(nSepIdx + 1);
		switch (strField) {
			case "options": {
				if (!isOptionKey(strKey) || typeof v !== "boolean") {
					continue;
				}

				pResult.options[strKey] = v;
				break;
			}

			case "params":
			case "simpleParams": {
				if (!isWindowParam(strKey) || !isWindowParamValue(v)) {
					continue;
				}

				pResult[strField][strKey] = v;
				break;
			}
		}
	}
	return pResult;
}

export function ParseParam(k: WindowParam_t, v: WindowParamValue_t) {
	switch (true) {
		case Array.isArray(v):
			return v.reduce((a, b) => a | b).toString();
		case k === "restoredetails":
			return decodeURIComponent(v as string);
		default:
			return v;
	}
}

export function ParseParamForHTMLAttribute(
	k: WindowParam_t,
	v: WindowParamValue_t,
): string {
	switch (true) {
		case !!mapParamEnums[k]:
			return mapParamEnums[k][v as string];
		case !!mapParamFlags[k]:
			return (v as number[]).map((e) => mapParamFlags[k][e]).join(" ");
		default:
			// The only number[] values are in the above maps already, the only
			// ones left are strings.
			return v as string;
	}
}

export function ResetSettings() {
	pluginConfig.delete(PLUGIN_NAME);
}
