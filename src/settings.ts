import { findModuleByExport, pluginSelf } from "@steambrew/client";

import plugin from "../plugin.json";
import {
	EBrowserType,
	EPopupCreationFlags,
} from "./sharedjscontextglobals/normal";

/**
 * `number[]` - flags,
 * `string` - everything else.
 */
type ParamValue_t = number[] | string;
export interface Settings {
	params: {
		[param: string]: ParamValue_t;
	};
}

const k_strSettingsKey = `${plugin.name}_Settings`;

export const mapParamEnums = {
	browserType: EBrowserType,
	vrOverlayKey: Object.values(
		findModuleByExport((m) => m === "valve.steam.gamepadui.main"),
	) as string[],
};

export const mapParamFlags = {
	createflags: EPopupCreationFlags,
};

export async function GetSettings(): Promise<Settings> {
	const strDefaultJSON = JSON.stringify({
		params: {},
	});
	const pSettings = await SteamClient.MachineStorage.GetJSON(
		k_strSettingsKey,
	).catch(() => strDefaultJSON);

	return JSON.parse(pSettings as string);
}

export function ParseParam(k: string, v: ParamValue_t) {
	switch (true) {
		case Array.isArray(v):
			return v.reduce((a, b) => a | b).toString();
		case k === "restoredetails":
			return decodeURIComponent(v);
		default:
			return v;
	}
}

export function ParseParamForHTMLAttribute(k: string, v: ParamValue_t): string {
	switch (true) {
		case !!mapParamEnums[k]:
			return mapParamEnums[k][v];
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
	value: ParamValue_t,
	field: keyof Settings,
) {
	const pSettings = await GetSettings();
	pSettings[field][key] = value;

	SteamClient.MachineStorage.SetObject(k_strSettingsKey, pSettings);
}

pluginSelf.GetSettings = GetSettings;
pluginSelf.ParseParam = ParseParam;
pluginSelf.ResetSettings = ResetSettings;
pluginSelf.SetSettingsKey = SetSettingsKey;
