import {
	ConfirmModal,
	DialogControlsSection,
	Dropdown,
	Field,
	type FieldProps,
	PanelSectionRow,
	type SingleDropdownOption,
	TextField,
	Toggle,
} from "@steambrew/client";
import {
	type PropsWithChildren,
	type ReactNode,
	useCallback,
	useEffect,
	useState,
} from "react";

import { LocalizedButton, LocalizedPanelSection } from "@/components/localized";
import { PLUGIN_NAME } from "@/consts";
import { CLog } from "@/logger";
import { BBCodeParser } from "@/modules/bbcode";
import { Localize } from "@/modules/localization";
import {
	GetSettings,
	mapParamEnums,
	mapParamFlags,
	RemoveSettingsKey,
	ResetSettings,
	SetSettingsKey,
	type Settings,
	type WindowParamValue_t,
} from "@/settings";
import {
	EBrowserType,
	EPopupCreationFlags,
	type WindowParam_t,
	type WindowParamMap_t,
} from "@/types";
import {
	AreTwoArraysEqual,
	EnumToDropdown,
	EnumToObject,
	ShowDialog,
} from "@/utils";

// biome-ignore lint/correctness/noUnusedVariables: Needed for demonstration
enum EParamType {
	Boolean,
	Enum,
	Flags,
	Number,
	String,
}

type PageMapFn_t = (param: WindowParam_t) => ReactNode;

const k_vecParamTypes = ["Booleans", "Enums", "Flags", "Numbers", "Strings"];
const k_pDefaultDropdownValue: SingleDropdownOption = { data: 0, label: "--" };

const mapParamDescriptionArgs: WindowParamMap_t<string[]> = {
	restoredetails: ["1&x=604&y=257&w=1010&h=600"],
	useragent: [navigator.userAgent],
};

/**
 * Keep in sync with {@link EParamType}
 */
const vecWindowParams: WindowParam_t[][] = [
	["modal", "pinned"],
	["browserType", "vrOverlayKey"],
	["createflags"],
	[
		"browser",
		"browserviewpopup",
		"centerOnBrowserID",
		"hwndParent",
		"minheight",
		"minwidth",
		"openerid",
		"parentcontainerpopupid",
		"parentpopup",
		"requestid",
		"screenavailwidth",
		"screenavailheight",
	],
	["restoredetails", "useragent"],
];

const g_pLogger = new CLog("settingspanel");
// For now createflags is the only bitflag param, so don't bother
const g_setFlags = new Set<number>();

const SettingsDialogSubHeader = ({ children }: PropsWithChildren) => (
	<div className="SettingsDialogSubHeader">{children}</div>
);

/**
 * Keep a state value in sync with a getter function.
 */
function useSyncedValue<T>(fnReadValue: () => T, vecDeps: readonly unknown[]) {
	const [value, setValue] = useState<T>(fnReadValue);

	useEffect(() => {
		setValue(fnReadValue());
	}, vecDeps);

	return [value, setValue] as const;
}

/**
 * @param strTitle Loc token
 * @param strDescription NOT Loc token
 * @param onOK
 */
function ShowWarningDialog(
	strTitle: string,
	strDescription: string,
	onOK: () => void,
) {
	ShowDialog(
		<ConfirmModal bDestructiveWarning onOK={onOK} strTitle={Localize(strTitle)}>
			<style>{".DialogBodyText code { user-select: all; }"}</style>
			<BBCodeParser text={strDescription} />
		</ConfirmModal>,
		{ bNeverPopOut: true },
	);
}

function ChangeParamValue(name: WindowParam_t, value: WindowParamValue_t) {
	SetSettingsKey("params", name, value);
	g_pLogger.Log("Setting param %o to value %o", name, value);
}

function GetParamValue<T extends WindowParamValue_t>(name: WindowParam_t) {
	const settings = GetSettings();
	return settings.params[name] as T;
}

function ToggleSettingValue<
	F extends keyof Settings,
	K extends keyof Settings[F],
>(field: F, key: K, value: Settings[F][K]) {
	if (value) {
		SetSettingsKey(field, key, value);
		g_pLogger.Log("Setting param %o to value %o", key, value);
	} else {
		RemoveSettingsKey(field, key);
		g_pLogger.Log("Removing %o from %o", key, field);
	}
}

function GetBooleanSettingValue(strName: keyof Settings["options"]) {
	const { options } = GetSettings();
	return !!options[strName];
}

function GetSimpleParamValue(mapParams: WindowParamMap_t<WindowParamValue_t>) {
	const { simpleParams } = GetSettings();

	return Object.entries(mapParams).every(([param, paramValue]) => {
		const lhs = simpleParams[param];
		const rhs = paramValue;

		return Array.isArray(paramValue)
			? AreTwoArraysEqual(lhs, rhs as number[])
			: Number(lhs) === Number(rhs);
	});
}

interface ParamProps {
	name: WindowParam_t;
}

interface ParamFieldProps extends PropsWithChildren {
	fieldProps?: Exclude<FieldProps, "description" | "label">;

	/**
	 * Param name.
	 */
	label: string;

	/**
	 * Description loc token.
	 */
	description: string;
}

function ParamField(props: ParamFieldProps) {
	const { label, description, fieldProps, children } = props;
	const args = mapParamDescriptionArgs[label] || [];
	const text = Localize(description, ...args);
	const bbcode = <BBCodeParser text={text} />;

	return (
		<Field label={label} description={bbcode} {...fieldProps}>
			{children}
		</Field>
	);
}

function BoolParam(props: ParamProps) {
	const { name } = props;
	const token = `#ChangeWindowParams_ParamDesc_Bool_${name}`;

	const [value, setValue] = useSyncedValue(
		() => GetParamValue<boolean>(name),
		[name],
	);

	const onChange = useCallback(
		(value: boolean) => {
			setValue(value);
			ChangeParamValue(name, value);
		},
		[name, setValue],
	);

	return (
		<ParamField label={name} description={token}>
			<Toggle onChange={onChange} value={value} />
		</ParamField>
	);
}

function EnumParam(props: ParamProps) {
	const { name } = props;
	const token = `#ChangeWindowParams_ParamDesc_Enum_${name}`;
	const enumValues = mapParamEnums[name];
	const actualValue = Array.isArray(enumValues)
		? enumValues.map((e) => ({ data: e, label: e }))
		: EnumToDropdown(enumValues);

	const [value, setValue] = useSyncedValue<SingleDropdownOption>(() => {
		const param = Number(GetParamValue<string>(name));
		const label = mapParamEnums[name][param];
		return param ? { data: param, label } : k_pDefaultDropdownValue;
	}, [name]);

	const onChange = useCallback(
		(value: SingleDropdownOption) => {
			const nextValueText = value.data.toString();
			setValue(value);
			ChangeParamValue(name, nextValueText);
			g_pLogger.Warn("ChangeParam(%o): %o", name, value);
		},
		[name, setValue],
	);

	return (
		<ParamField label={name} description={token}>
			<Dropdown
				contextMenuPositionOptions={{ bMatchWidth: false }}
				onChange={onChange}
				rgOptions={actualValue}
				selectedOption={value.data}
			/>
		</ParamField>
	);
}

interface FlagParamProps extends ParamProps {
	flag: number;
	member: string;
}

function FlagParam(props: FlagParamProps) {
	const { name, member, flag } = props;
	const token = `#ChangeWindowParams_ParamDesc_Flag_${name}_${member}`;

	const [value, setValue] = useSyncedValue<boolean>(() => {
		const param = GetParamValue<number[]>(name) || [];
		for (const entry of param) {
			g_setFlags.add(entry);
		}
		return param.includes(flag);
	}, [name, flag]);

	const onChange = useCallback(
		(value: boolean) => {
			g_setFlags[value ? "add" : "delete"](flag);
			const vecAllFlags = [...g_setFlags];
			setValue(value);
			SetSettingsKey("params", name, vecAllFlags);
			g_pLogger.Log("%o => %o", name, vecAllFlags);
		},
		[name, flag, setValue],
	);

	return (
		<ParamField label={member} description={token}>
			<Toggle onChange={onChange} value={value} />
		</ParamField>
	);
}

interface TextParamProps extends ParamProps {
	bNumeric?: boolean;
}

function TextParam(props: TextParamProps) {
	const { bNumeric, name } = props;
	const token = `#ChangeWindowParams_ParamDesc_Text_${name}`;

	const [value, setValue] = useSyncedValue<string>(
		() => GetParamValue<string>(name),
		[name],
	);

	return (
		<ParamField
			fieldProps={{ inlineWrap: "shift-children-below" }}
			label={name}
			description={token}
		>
			<TextField
				onChange={(ev) => {
					const { value } = ev.target;
					setValue(value);
					ChangeParamValue(name, value);
				}}
				mustBeNumeric={bNumeric}
				value={value}
			/>
		</ParamField>
	);
}

interface BooleanSettingFieldProps {
	/**
	 * {@link FieldProps.label} is not used, so use {@link strName} instead.
	 */
	fieldProps?: Exclude<FieldProps, "label">;

	/**
	 * Part of the `#ChangeWindowParams_Verified_${name}` loc token.
	 */
	strName: keyof Settings["options"];
}

function BooleanSetting(props: BooleanSettingFieldProps) {
	const { fieldProps, strName } = props;
	const label = Localize(`#ChangeWindowParams_Verified_${strName}`);

	const [value, setValue] = useSyncedValue<boolean>(
		() => GetBooleanSettingValue(strName),
		[strName],
	);

	const onChange = useCallback(
		(value: boolean) => {
			ToggleSettingValue("options", strName, value);
			setValue(value);
		},
		[strName, setValue],
	);

	return (
		<Field label={label} {...fieldProps}>
			<Toggle onChange={onChange} value={value} />
		</Field>
	);
}

interface SimpleParamProps extends BooleanSettingFieldProps {
	/**
	 * Params to change on toggle.
	 */
	mapParams: WindowParamMap_t<WindowParamValue_t>;
}

function SimpleParam(props: SimpleParamProps) {
	const { fieldProps, mapParams, strName } = props;
	const label = Localize(`#ChangeWindowParams_Verified_${strName}`);

	const [value, setValue] = useSyncedValue<boolean>(
		() => GetSimpleParamValue(mapParams),
		[mapParams, strName],
	);

	const onChange = useCallback(
		(value: boolean) => {
			for (const kv of Object.entries(mapParams)) {
				const [param, paramValue] = kv as [WindowParam_t, WindowParamValue_t];
				ToggleSettingValue("simpleParams", param, paramValue);
			}
			setValue(value);
		},
		[mapParams, setValue],
	);

	return (
		<Field label={label} {...fieldProps}>
			<Toggle onChange={onChange} value={value} />
		</Field>
	);
}

function VerifiedSettings() {
	return (
		<LocalizedPanelSection strToken="#ChangeWindowParams_Section_Verified">
			<BooleanSetting
				fieldProps={{
					bottomSeparator: "thick",
					description: Localize(
						"#ChangeWindowParams_Verified_ApplyMainWindowWorkaround_Description",
					),
				}}
				strName="ApplyMainWindowWorkaround"
			/>
			<SimpleParam
				mapParams={{ browserType: EBrowserType.DirectHWND.toString() }}
				strName="SystemTitlebar"
			/>
			<BooleanSetting fieldProps={{ indentLevel: 1 }} strName="IncludeMenus" />
			<BooleanSetting
				fieldProps={{ indentLevel: 1 }}
				strName="IncludeNotifications"
			/>
			<BooleanSetting
				fieldProps={{ indentLevel: 1 }}
				strName="IncludeOverlay"
			/>
			<SimpleParam
				mapParams={{
					createflags: [
						// TODO: not needed here, make a retain params option
						EPopupCreationFlags.Resizable,
						EPopupCreationFlags.Composited,
						EPopupCreationFlags.TransparentParentWindow,
					],
				}}
				strName="TransparentWindow"
			/>
			<SimpleParam
				mapParams={{ minheight: "0", minwidth: "0" }}
				strName="NoSizeLimit"
			/>
		</LocalizedPanelSection>
	);
}

function Actions() {
	return (
		<LocalizedPanelSection strToken="#ChangeWindowParams_ButtonsHeader">
			<LocalizedButton
				onClick={() => {
					const wnd = window.open("about:blank", "previewwindow");
					const elButton = wnd.document.createElement("button");
					elButton.textContent = Localize("#Generic_Close");
					elButton.addEventListener("click", () => {
						wnd.close();
					});
					wnd.document.body.appendChild(elButton);
				}}
				strToken="#ChangeWindowParams_Buttons_PreviewWindow"
			/>
			<LocalizedButton
				onClick={() => {
					ResetSettings();
				}}
				strToken="#ChangeWindowParams_Buttons_ResetSettings"
			/>
			<LocalizedButton
				onClick={() => {
					SteamClient.Browser.RestartJSContext();
				}}
				strToken="#ChangeWindowParams_Buttons_RestartSteam"
			/>
		</LocalizedPanelSection>
	);
}

function AdvancedSettings() {
	const [bAdvancedMode, setAdvancedMode] = useState(false);
	// Keep in sync with EParamType, too
	const vecContents: PageMapFn_t[] = [
		(param) => <BoolParam key={param} name={param} />,
		(param) => <EnumParam key={param} name={param} />,
		// TODO: retain flags option
		(param) => (
			<PanelSectionRow>
				<DialogControlsSection>
					<SettingsDialogSubHeader>{param}</SettingsDialogSubHeader>
					{EnumToObject(mapParamFlags[param]).map(([member, flag]) => (
						<FlagParam key={member} name={param} member={member} flag={flag} />
					))}
				</DialogControlsSection>
			</PanelSectionRow>
		),
		(param) => <TextParam key={param} bNumeric name={param} />,
		(param) => <TextParam key={param} name={param} />,
	];

	return !bAdvancedMode ? (
		<LocalizedPanelSection strToken="#ChangeWindowParams_AdvancedMode_Title">
			<LocalizedButton
				onClick={() => {
					const strDescription = Localize(
						"#ChangeWindowParams_AdvancedMode_Description",
						`steam://millennium/settings/plugins/disable/${PLUGIN_NAME}`,
					);
					ShowWarningDialog(
						"#ChangeWindowParams_AdvancedMode_Title",
						strDescription,
						() => setAdvancedMode(true),
					);
				}}
				strToken="#ChangeWindowParams_Buttons_AdvancedMode"
			/>
		</LocalizedPanelSection>
	) : (
		k_vecParamTypes.map((type, i) => (
			<LocalizedPanelSection
				key={type}
				strToken={`#ChangeWindowParams_Section_${type}`}
			>
				{vecWindowParams[i].map((param) => vecContents[i](param))}
			</LocalizedPanelSection>
		))
	);
}

export function SettingsPanel() {
	return (
		<>
			<Actions />
			<VerifiedSettings />
			<AdvancedSettings />
		</>
	);
}
