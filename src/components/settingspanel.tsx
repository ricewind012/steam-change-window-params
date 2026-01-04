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
	Component,
	type PropsWithChildren,
	type ReactNode,
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

	componentDidMount() {
		this.m_pSettings = GetSettings();
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
		SetSettingsKey("params", name, value as string);
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

		return param === true;
	}

	ChangeParam(value: boolean) {
		super.ChangeParam(value);
	}

	render() {
		const { name } = this.props;
		const token = `#ChangeWindowParams_ParamDesc_Bool_${name}`;

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
		const token = `#ChangeWindowParams_ParamDesc_Enum_${name}`;
		const value = mapParamEnums[name];
		const actualValue = Array.isArray(value)
			? value.map((e) => ({ data: e, label: e }))
			: EnumToDropdown(value);

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
		SetSettingsKey("params", name, vecAllFlags);
		g_pLogger.Log("%o => %o", name, vecAllFlags);
	}

	render() {
		const { name, member } = this.props;
		const token = `#ChangeWindowParams_ParamDesc_Flag_${name}_${member}`;

		return (
			<ParamField label={member} description={token}>
				<Toggle
					onChange={(value) => this.ChangeParam(value)}
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
		const token = `#ChangeWindowParams_ParamDesc_Text_${name}`;

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

interface BooleanSettingFieldProps {
	/**
	 * {@link FieldProps.label} is not used, so use {@link strName} instead.
	 */
	fieldProps?: Exclude<FieldProps, "label">;

	/**
	 * Part of the `#ChangeWindowParams_Verified_${name}` loc token.
	 */
	strName: string;
}

interface BooleanSettingFieldState {
	value: boolean;
}

/**
 * Base component for boolean fields in verified settings, as some options are
 * changed differently.
 */
abstract class BooleanSettingFieldBase<
	F extends keyof Settings,
	// biome-ignore lint/complexity/noBannedTypes: stfu
	P = {},
> extends Component<BooleanSettingFieldProps & P, BooleanSettingFieldState> {
	/**
	 * The settings field to use on change.
	 */
	abstract m_strSettingsField: F;

	/**
	 * @returns the initial value to set on render.
	 */
	abstract GetInitialValue(): boolean;

	abstract OnChange(value: boolean): void;

	state: BooleanSettingFieldState = { value: false };

	componentDidMount() {
		const value = this.GetInitialValue();
		this.setState({ value });
	}

	ToggleSetting<K extends keyof Settings[F]>(key: K, value: Settings[F][K]) {
		if (value) {
			SetSettingsKey(this.m_strSettingsField, key, value);
			g_pLogger.Log("Setting param %o to value %o", key, value);
		} else {
			RemoveSettingsKey(this.m_strSettingsField, key);
			g_pLogger.Log("Removing %o from %o", key, this.m_strSettingsField);
		}
	}

	render() {
		const { fieldProps, strName } = this.props;
		const label = Localize(`#ChangeWindowParams_Verified_${strName}`);

		return (
			<Field label={label} {...fieldProps}>
				<Toggle
					onChange={(value) => this.OnChange(value)}
					value={this.state.value}
				/>
			</Field>
		);
	}
}

class BooleanSetting extends BooleanSettingFieldBase<"options"> {
	// ????? wtf ts
	m_strSettingsField: "options" = "options";

	GetInitialValue() {
		const { strName } = this.props;
		const { options } = GetSettings();
		return options[strName];
	}

	OnChange(value: boolean) {
		const { strName } = this.props;
		this.ToggleSetting(strName as keyof Settings["options"], value);
		this.setState({ value });
	}
}

interface SimpleParamProps extends BooleanSettingFieldProps {
	/**
	 * Params to change on toggle.
	 */
	mapParams: WindowParamMap_t<WindowParamValue_t>;
}

/**
 * A user friendly toggle field that has *confirmed* functionality, i.e. without
 * side effects.
 */
class SimpleParam extends BooleanSettingFieldBase<
	"simpleParams",
	SimpleParamProps
> {
	// ????? wtf ts
	m_strSettingsField: "simpleParams" = "simpleParams";

	GetInitialValue() {
		const { mapParams } = this.props;
		const { simpleParams } = GetSettings();

		return Object.entries(mapParams).every(([param, paramValue]) => {
			const lhs = simpleParams[param];
			const rhs = paramValue;

			return Array.isArray(paramValue)
				? AreTwoArraysEqual(lhs, rhs as number[])
				: Number(lhs) === Number(rhs);
		});
	}

	OnChange(value: boolean) {
		const { mapParams } = this.props;
		for (const [param, paramValue] of Object.entries(mapParams)) {
			this.ToggleSetting(param as WindowParam_t, paramValue);
		}
		this.setState({ value });
	}
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
			<BooleanSetting fieldProps={{ indentLevel: 1 }} strName="ExcludeMenus" />
			<BooleanSetting
				fieldProps={{ indentLevel: 1 }}
				strName="ExcludeNotifications"
			/>
			<BooleanSetting
				fieldProps={{ indentLevel: 1 }}
				strName="ExcludeOverlay"
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
		(param) => <BoolParam name={param} />,
		(param) => <EnumParam name={param} />,
		// TODO: retain flags option
		(param) => (
			<PanelSectionRow>
				<DialogControlsSection>
					<SettingsDialogSubHeader>{param}</SettingsDialogSubHeader>
					{EnumToObject(mapParamFlags[param]).map(([member, flag]) => (
						<FlagParam name={param} member={member} flag={flag} />
					))}
				</DialogControlsSection>
			</PanelSectionRow>
		),
		(param) => <TextParam bNumeric name={param} />,
		(param) => <TextParam name={param} />,
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
			<LocalizedPanelSection strToken={`#ChangeWindowParams_Section_${type}`}>
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
