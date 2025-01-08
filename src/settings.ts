import { pluginSelf } from "@steambrew/client";
import plugin from "../plugin.json";

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

export async function GetSettings(): Promise<Settings> {
	const strDefaultJSON = JSON.stringify({
		params: {},
	});
	const pSettings = await SteamClient.MachineStorage.GetJSON(
		k_strSettingsKey,
	).catch(() => strDefaultJSON);

	return JSON.parse(pSettings);
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
