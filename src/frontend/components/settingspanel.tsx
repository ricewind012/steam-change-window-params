import {
	ConfirmModal,
	DialogControlsSection,
	Dropdown,
	Field,
	type FieldProps,
	PanelSectionRow,
	pluginConfig,
	type ShowModalProps,
	type SingleDropdownOption,
	showModal,
	TextField,
	Toggle,
	usePluginConfig,
} from "millennium";
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
	BuildSettingsKey,
	GetSettings,
	mapParamEnums,
	mapParamFlags,
	ResetSettings,
	type Settings,
	type WindowParamValue_t,
} from "@/settings";
import {
	EBrowserType,
	EPopupCreationFlags,
	type WindowParam_t,
	type WindowParamMap_t,
} from "@/types";
import { AreTwoArraysEqual, EnumToDropdown, EnumToObject } from "@/utils";

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
 * Cool wrapper for {@link showModal} that doesn't require a parent.
 */
export function ShowDialog(modal: ReactNode, props: ShowModalProps) {
	const wnd = SteamUIStore.WindowStore.MainWindowInstance.BrowserWindow;
	return showModal(modal, wnd, props);
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

async function GetParamValue<T extends WindowParamValue_t>(
	name: WindowParam_t,
) {
	const settings = await GetSettings();
	return settings.params[name] as T;
}

async function ToggleSettingValue<
	F extends keyof Settings,
	K extends Exclude<keyof Settings[F], symbol>,
>(field: F, key: K, value: Settings[F][K] & string) {
	const strConfigKey = BuildSettingsKey(field, key);
	if (value) {
		await pluginConfig.set(strConfigKey, value);
		g_pLogger.Log("Setting param %o to value %o", key, value);
	} else {
		await pluginConfig.delete(strConfigKey);
		g_pLogger.Log("Removing %o from %o", key, field);
	}
}

async function GetSimpleParamValue(
	mapParams: WindowParamMap_t<WindowParamValue_t>,
) {
	const { simpleParams } = await GetSettings();

	return Object.entries(mapParams).every(([param, paramValue]) => {
		const lhs = simpleParams[param as WindowParam_t];
		const rhs = paramValue;

		return Array.isArray(paramValue)
			? AreTwoArraysEqual(lhs as number[], rhs as number[])
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
	label: WindowParam_t;

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

	const [value, setValue] = usePluginConfig<boolean>(
		BuildSettingsKey("params", name),
	);

	return (
		<ParamField label={name} description={token}>
			<Toggle onChange={(value) => setValue(value)} value={value} />
		</ParamField>
	);
}

function EnumParam(props: ParamProps) {
	const { name } = props;
	const token = `#ChangeWindowParams_ParamDesc_Enum_${name}`;
	const enumValues = mapParamEnums[name];
	const actualValue: SingleDropdownOption[] = Array.isArray(enumValues)
		? enumValues.map((e) => ({ data: e, label: e }))
		: EnumToDropdown(enumValues);

	const [value, setValue] = usePluginConfig<string>(
		BuildSettingsKey("params", name),
	);
	const num = Number(value);
	const selectedOption = num
		? { data: num, label: mapParamEnums[name][num] }
		: k_pDefaultDropdownValue;

	return (
		<ParamField label={name} description={token}>
			<Dropdown
				contextMenuPositionOptions={{ bMatchWidth: false }}
				onChange={(value) => setValue(value.data.toString())}
				rgOptions={actualValue}
				selectedOption={selectedOption.data}
			/>
		</ParamField>
	);
}

interface FlagParamProps extends ParamProps {
	flag: number;
	member: WindowParam_t;
}

function FlagParam(props: FlagParamProps) {
	const { name, member, flag } = props;
	const token = `#ChangeWindowParams_ParamDesc_Flag_${name}_${member}`;

	const [value, setValue] = usePluginConfig<boolean>(
		BuildSettingsKey("params", name),
	);

	const onChange = useCallback(
		(value: boolean) => {
			g_setFlags[value ? "add" : "delete"](flag);
			const vecAllFlags = [...g_setFlags];
			setValue(vecAllFlags);
			g_pLogger.Log("%o => %o", name, vecAllFlags);
		},
		[name, flag, setValue],
	);

	useEffect(() => {
		GetParamValue<number[]>(name).then((param) => {
			for (const entry of param) {
				g_setFlags.add(entry);
			}
			setValue(param.includes(flag));
		});
	}, []);

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

	const [value, setValue] = usePluginConfig<string>(
		BuildSettingsKey("params", name),
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

	const [value, setValue] = usePluginConfig<boolean>(
		BuildSettingsKey("options", strName),
	);

	return (
		<Field label={label} {...fieldProps}>
			<Toggle onChange={(value) => setValue(value)} value={value} />
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

	const [value, setValue] = usePluginConfig<boolean>(
		BuildSettingsKey("options", strName),
	);
	const onChange = useCallback(
		async (value: boolean) => {
			for (const kv of Object.entries(mapParams)) {
				const [param, paramValue] = kv as [
					WindowParam_t,
					WindowParamValue_t & string,
				];
				await ToggleSettingValue("simpleParams", param, paramValue);
			}
			setValue(value);
		},
		[mapParams, setValue],
	);

	useEffect(() => {
		GetSimpleParamValue(mapParams).then((value) => {
			setValue(value);
		});
	}, []);

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
						<FlagParam
							key={member}
							name={param}
							member={member as WindowParam_t}
							flag={flag}
						/>
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
