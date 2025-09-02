import { findModuleByExport, pluginSelf } from "@steambrew/client";

import plugin from "../plugin.json";
import {
	EBrowserType,
	EPopupCreationFlags,
} from "./sharedjscontextglobals/normal";
import type { WindowParam_t, WindowParamMap_t } from "./types";

export type GetParamsResult_t = [WindowParam_t, WindowParamValue_t][];

/**
 * `number[]` - flags,
 * `string` - everything else.
 */
export type WindowParamValue_t = number[] | string;

export interface Settings {
	params: WindowParamMap_t<WindowParamValue_t>;
	simpleParams: WindowParamMap_t<WindowParamValue_t>;
}

const k_strSettingsKey = `${plugin.name}_Settings`;
const k_pDefaultJSON: Settings = {
	params: {},
	simpleParams: {},
};

export const mapParamEnums: WindowParamMap_t<object> = {
	browserType: EBrowserType,
	vrOverlayKey: Object.values(
		findModuleByExport((m) => m === "valve.steam.gamepadui.main"),
	) as string[],
};

export const mapParamFlags: WindowParamMap_t<object> = {
	createflags: EPopupCreationFlags,
};

/**
 * Gets params from settings, proritizing `simpleParams` over `params`, since
 * they're not compatible.
 */
export async function GetParams() {
	const { params, simpleParams } = await GetSettings();
	const bUseSimpleParams = Object.keys(simpleParams).length !== 0;
	const pResult = bUseSimpleParams ? simpleParams : params;

	return Object.entries(pResult) as GetParamsResult_t;
}

export async function GetSettings(): Promise<Settings> {
	const strDefaultJSON = JSON.stringify(k_pDefaultJSON);
	const pSettings = await SteamClient.MachineStorage.GetJSON(
		k_strSettingsKey,
	).catch(() => strDefaultJSON);

	return JSON.parse(pSettings as string);
}

export function ParseParam(k: WindowParam_t, v: WindowParamValue_t) {
	switch (true) {
		case Array.isArray(v):
			return (v as number[]).reduce((a, b) => a | b).toString();
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
			return (v as unknown as number[])
				.map((e) => mapParamFlags[k][e])
				.join(" ");
		default:
			// The only number[] values are in the above maps already, the only
			// ones left are strings.
			return v as string;
	}
}

export function ResetSettings() {
	SteamClient.MachineStorage.DeleteKey(k_strSettingsKey);
}

export async function SetSettingsKey(
	key: string,
	value: WindowParamValue_t,
	field: keyof Settings,
) {
	const pSettings = await GetSettings();
	pSettings[field][key] = value;

	SteamClient.MachineStorage.SetObject(k_strSettingsKey, pSettings);
}

export async function RemoveSettingsKey(key: string, field: keyof Settings) {
	const pSettings = await GetSettings();
	delete pSettings[field][key];

	SteamClient.MachineStorage.SetObject(k_strSettingsKey, pSettings);
}

pluginSelf.GetParams = GetParams;
pluginSelf.GetSettings = GetSettings;
pluginSelf.ParseParam = ParseParam;
pluginSelf.ResetSettings = ResetSettings;
pluginSelf.SetSettingsKey = SetSettingsKey;
pluginSelf.RemoveSettingsKey = RemoveSettingsKey;
