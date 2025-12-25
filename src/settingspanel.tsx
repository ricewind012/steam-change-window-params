import {
	ConfirmModal,
	DialogButton,
	Dropdown,
	Field,
	type FieldProps,
	PanelSection,
	PanelSectionRow,
	type SingleDropdownOption,
	showModal,
	TextField,
	Toggle,
} from "@steambrew/client";
import { Component, useState } from "react";

import { CLog } from "./logger";
import { BBCodeParser } from "./modules/bbcode";
import { Localize } from "./modules/localization";
import {
	GetSettings,
	mapParamEnums,
	mapParamFlags,
	RemoveSettingsKey,
	ResetSettings,
	SetSettingsKey,
	type Settings,
	type WindowParamValue_t,
} from "./settings";
import {
	EBrowserType,
	EPopupCreationFlags,
} from "./sharedjscontextglobals/normal";
import type { WindowParam_t, WindowParamMap_t } from "./types";

// biome-ignore lint/correctness/noUnusedVariables: Needed for demonstration
enum EParamType {
	Boolean,
	Enum,
	Flags,
	Number,
	String,
}

type EnumObject_t = [string, number][];
type PageMapFn_t = (param: WindowParam_t) => JSX.Element;

const k_vecParamTypes = ["Booleans", "Enums", "Flags", "Numbers", "Strings"];
const k_pDefaultDropdownValue: SingleDropdownOption = { data: 0, label: "--" };
const k_pWarners: WindowParamMap_t<string[]> = {
	browserType: ["OffScreen", "Offscreen_SteamUI"],
	createflags: ["Hidden"],
};

const mapParamDescriptionArgs: WindowParamMap_t<string[]> = {
	restoredetails: ["1&x=604&y=257&w=1010&h=600"],
	useragent: [
		"Mozilla/5.0 (X11; Linux x86_64; Valve Steam Client [Steam Beta Update]/default/0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.5414.120 Safari/537.36",
	],
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

// biome-ignore lint/suspicious/noExplicitAny: intentional
const EnumToObject = (e: any) =>
	Object.entries(e).filter((e) => typeof e[1] === "number") as EnumObject_t;

// biome-ignore lint/suspicious/noExplicitAny: intentional
const EnumToDropdown = (e: any) =>
	EnumToObject(e).map((e) => ({
		data: e[1],
		label: e[0],
	})) as SingleDropdownOption[];

const SettingsDialogSubHeader = ({ children }) => (
	<div className="SettingsDialogSubHeader">{children}</div>
);

interface LocalizedButtonProps {
	onClick: () => void;
	strToken: string;
}

function LocalizedButton(props: LocalizedButtonProps) {
	const { onClick, strToken } = props;
	return <DialogButton onClick={onClick}>{Localize(strToken)}</DialogButton>;
}

// biome-ignore lint/suspicious/noExplicitAny: intentional
function AreTwoArraysEqual(lhs: any[], rhs: any[]) {
	if (!lhs || !rhs) {
		return false;
	}
	if (!Array.isArray(lhs) || !Array.isArray(rhs)) {
		return false;
	}
	if (lhs.length !== rhs.length) {
		return false;
	}

	for (let i = 0; i < lhs.length; i++) {
		if (lhs[i] !== rhs[i]) {
			return false;
		}
	}

	return true;
}

/**
 * @param strDescription Loc token
 * @param strTitle Loc token
 * @param onOK
 */
function ShowWarningDialog(
	strTitle: string,
	strDescription: string,
	onOK: () => void,
) {
	const wnd = g_PopupManager.GetExistingPopup("SP Desktop_uid0").m_popup;
	showModal(
		<ConfirmModal
			bDestructiveWarning
			strTitle={Localize(strTitle)}
			strDescription={<BBCodeParser text={Localize(strDescription)} />}
			onOK={onOK}
		/>,
		wnd,
		{ bNeverPopOut: true },
	);
}

interface ParamProps {
	name: WindowParam_t;
}

interface ParamState<T> {
	value: T;
}

class Param<S, P = ParamProps> extends Component<
	ParamProps & P,
	ParamState<S>
> {
	public m_pSettings: Settings;

	async componentDidMount() {
		this.m_pSettings = await GetSettings();
		const value = this.ConvertParamToState();
		this.setState({ value });
	}

	ConvertParamToState() {
		const param = this.m_pSettings.params[this.props.name];

		return param as S;
	}

	ChangeParam(value: S) {
		const { name } = this.props;
		this.setState({ value });
		SetSettingsKey(name, value as string, "params");
		g_pLogger.Log("Setting param %o to value %o", name, value);
	}
}

interface ParamFieldProps extends FieldProps {
	/** Param name. */
	label: string;
	/** Description loc token. */
	description: string;
}

function ParamField({ label, description, children }: ParamFieldProps) {
	const args = mapParamDescriptionArgs[label] || [];
	const text = Localize(description, ...args);
	const bbcode = <BBCodeParser text={text} />;

	return (
		<Field label={label} description={bbcode}>
			{children}
		</Field>
	);
}

class BoolParam extends Param<boolean> {
	constructor(props: ParamProps) {
		super(props);
		this.state = { value: false };
	}

	ConvertParamToState() {
		const param = this.m_pSettings.params[this.props.name];

		return param === "true";
	}

	/**
	 * VDF does not have them and turns bools into 1/0.
	 */
	ChangeParam(value: boolean) {
		// fuck off, retard
		super.ChangeParam(value.toString() as unknown as boolean);
	}

	render() {
		const { name } = this.props;
		const token = `#ChangeWindowParams_ParamDesc_${name}`;

		return (
			<ParamField label={name} description={token}>
				<Toggle
					onChange={(value) => this.ChangeParam(value)}
					value={this.state.value}
				/>
			</ParamField>
		);
	}
}

class EnumParam extends Param<SingleDropdownOption> {
	constructor(props: ParamProps) {
		super(props);
		this.state = { value: k_pDefaultDropdownValue };
	}

	ConvertParamToState() {
		const { name } = this.props;
		const param = Number(this.m_pSettings.params[name]);
		const label = mapParamEnums[name][param];

		return param ? { data: param, label } : k_pDefaultDropdownValue;
	}

	ChangeParam(value: SingleDropdownOption) {
		super.ChangeParam(value.data.toString());
		g_pLogger.Warn("ChangeParam(%o): %o", this.props.name, value);
	}

	render() {
		const { name } = this.props;
		const token = `#ChangeWindowParams_ParamDesc_${name}`;
		const value = mapParamEnums[name];
		const actualValue = Array.isArray(value)
			? value.map((e) => ({ data: e, label: e }))
			: EnumToDropdown(value);
		// TODO desc in dropdown? idk

		return (
			<ParamField label={name} description={token}>
				<Dropdown
					contextMenuPositionOptions={{ bMatchWidth: false }}
					onChange={(value) => this.ChangeParam(value)}
					rgOptions={actualValue}
					selectedOption={this.state.value.data}
				/>
			</ParamField>
		);
	}
}

interface FlagParamProps extends ParamProps {
	flag: number;
	member: string;
}

class FlagParam extends Param<boolean, FlagParamProps> {
	constructor(props: FlagParamProps) {
		super(props);
		this.state = { value: false };
	}

	ConvertParamToState() {
		const { flag } = this.props;
		// may not be set on empty settings
		const param = (this.m_pSettings.params[this.props.name] || []) as number[];

		// this method runs on mount anyway
		for (const flag of param) {
			g_setFlags.add(flag);
		}

		return param.includes(flag);
	}

	ChangeParam(value: boolean) {
		const { flag, name } = this.props;
		g_setFlags[value ? "add" : "delete"](flag);
		const vecAllFlags = [...g_setFlags];
		this.setState({ value });
		SetSettingsKey(name, vecAllFlags, "params");
		g_pLogger.Log("%o => %o", name, vecAllFlags);
	}

	OnChange(value: boolean) {
		const { name, member } = this.props;
		const onOK = () => {
			this.ChangeParam(value);
		};

		const bShowDialog = value && k_pWarners[name]?.some((e) => member === e);
		if (bShowDialog) {
			ShowWarningDialog(
				"#ChangeWindowParams_Dialog_WarningTitle",
				"#ChangeWindowParams_Dialog_WarningDescription",
				onOK,
			);
			return;
		}

		onOK();
	}

	render() {
		const { name, member } = this.props;
		const token = `#ChangeWindowParams_FlagDesc_${name}_${member}`;

		return (
			<ParamField label={member} description={token}>
				<Toggle
					onChange={(value) => this.OnChange(value)}
					value={this.state.value}
				/>
			</ParamField>
		);
	}
}

interface TextParamProps extends ParamProps {
	bNumeric?: boolean;
}

class TextParam extends Param<string, TextParamProps> {
	constructor(props: TextParamProps) {
		super(props);
		this.state = { value: "" };
	}

	render() {
		const { bNumeric, name } = this.props;
		const token = `#ChangeWindowParams_ParamDesc_${name}`;

		return (
			<ParamField label={name} description={token}>
				<TextField
					onChange={({ target }) => this.ChangeParam(target.value)}
					mustBeNumeric={bNumeric}
					value={this.state.value}
				/>
			</ParamField>
		);
	}
}

interface SimpleParamProps {
	/**
	 * Params to change for this field.
	 */
	mapParams: WindowParamMap_t<WindowParamValue_t>;

	/**
	 * For the `#ChangeWindowParams_Verified_${name}` loc token.
	 */
	strName: string;
}

interface SimpleParamState {
	value: boolean;
}

/**
 * A user friendly toggle field that has *confirmed* functionality, i.e. without
 * side effects.
 */
class SimpleParam extends Component<SimpleParamProps, SimpleParamState> {
	state: SimpleParamState = { value: false };

	async componentDidMount() {
		const { mapParams } = this.props;
		const { simpleParams } = await GetSettings();
		const value = Object.entries(mapParams).every(([param, paramValue]) => {
			const lhs = simpleParams[param];
			const rhs = paramValue;

			return Array.isArray(paramValue)
				? AreTwoArraysEqual(lhs, rhs as number[])
				: Number(lhs) === Number(rhs);
		});

		this.setState({ value });
	}

	async OnChange(value: boolean) {
		const { mapParams } = this.props;
		for (const [param, paramValue] of Object.entries(mapParams)) {
			if (value) {
				await SetSettingsKey(param, paramValue, "simpleParams");
				g_pLogger.Log("Setting param %o to value %o", param, paramValue);
			} else {
				await RemoveSettingsKey(param, "simpleParams");
				g_pLogger.Log("Removing %o from %o", param, "simpleParams");
			}
		}
		this.setState({ value });
	}

	render() {
		const { strName } = this.props;
		const label = Localize(`#ChangeWindowParams_Verified_${strName}`);

		return (
			<Field label={label}>
				<Toggle
					onChange={(value) => this.OnChange(value)}
					value={this.state.value}
				/>
			</Field>
		);
	}
}

function VerifiedSettings() {
	return (
		<PanelSection title={Localize("#ChangeWindowParams_Tab_Verified")}>
			<SimpleParam
				mapParams={{ browserType: EBrowserType.DirectHWND.toString() }}
				strName="SystemTitlebar"
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
		</PanelSection>
	);
}

export function SettingsPanel() {
	const [bAdvancedMode, setAdvancedMode] = useState(false);
	// Keep in sync with EParamType, too
	const vecContents: PageMapFn_t[] = [
		(param) => <BoolParam name={param} />,
		(param) => <EnumParam name={param} />,
		// TODO: retain flags option
		(param) => (
			<PanelSectionRow>
				<div>
					<SettingsDialogSubHeader>{param}</SettingsDialogSubHeader>
					{EnumToObject(mapParamFlags[param]).map(([member, flag]) => (
						<FlagParam name={param} member={member} flag={flag} />
					))}
				</div>
			</PanelSectionRow>
		),
		(param) => <TextParam bNumeric name={param} />,
		(param) => <TextParam name={param} />,
	];

	return (
		<>
			<PanelSection>
				<LocalizedButton
					onClick={() => {
						ResetSettings();
						SteamClient.Browser.RestartJSContext();
					}}
					strToken="#ChangeWindowParams_Buttons_ResetSettings"
				/>
			</PanelSection>
			<VerifiedSettings />
			{!bAdvancedMode ? (
				<PanelSection>
					<LocalizedButton
						onClick={() => {
							ShowWarningDialog(
								"#ChangeWindowParams_AdvancedMode_Title",
								"#ChangeWindowParams_AdvancedMode_Description",
								() => setAdvancedMode(true),
							);
						}}
						strToken="#ChangeWindowParams_Buttons_AdvancedMode"
					/>
				</PanelSection>
			) : (
				k_vecParamTypes.map((type, i) => (
					<PanelSection title={Localize(`#ChangeWindowParams_Tab_${type}`)}>
						{vecWindowParams[i].map((param) => vecContents[i](param))}
					</PanelSection>
				))
			)}
		</>
	);
}
