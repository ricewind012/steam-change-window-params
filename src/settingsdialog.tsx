import {
	ConfirmModal,
	DialogBody,
	DialogControlsSection,
	Dropdown,
	Field,
	IconsModule,
	ModalPosition,
	SidebarNavigation,
	TextField,
	Toggle,
	findModule,
	findModuleByExport,
	pluginSelf,
	showModal,
	type FieldProps,
	type SidebarNavigationPage,
	type SingleDropdownOption,
} from "@steambrew/client";
import { Component } from "react";
import { CLog } from "./logger";
import { GetSettings, SetSettingsKey, type Settings } from "./settings";
import {
	EBrowserType,
	EPopupCreationFlags,
} from "./sharedjscontextglobals/normal/shared/enums";
import { BBCodeParser } from "./modules/bbcode";
import { Localize } from "./modules/localization";

enum EParamType {
	Boolean,
	Enum,
	Flags,
	Number,
	String,
}

type EnumObject_t = [string, number][];
type PageMapFn_t = (param: string) => JSX.Element;
type WarningDisplayer_t = { [member: string]: string[] };

const k_vecParamTypes = ["Booleans", "Enums", "Flags", "Numbers", "Strings"];
const k_pDefaultDropdownValue: SingleDropdownOption = { data: 0, label: "--" };
const k_pWarners: WarningDisplayer_t = {
	browserType: ["OffScreen", "Offscreen_SteamUI"],
	createflags: ["Hidden"],
};

const mapParamEnums = {
	browserType: EBrowserType,
	vrOverlayKey: Object.values(
		findModuleByExport((m) => m === "valve.steam.gamepadui.main"),
	) as string[],
};
const mapParamFlags = {
	createflags: EPopupCreationFlags,
};
const mapParamDescriptionArgs = {
	restoredetails: ["1&x=604&y=257&w=1010&h=600"],
	useragent: [
		"Mozilla/5.0 (X11; Linux x86_64; Valve Steam Client [Steam Beta Update]/default/0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.5414.120 Safari/537.36",
	],
};

// Keep these in sync with EParamType
const vecWindowParams = [
	["modal", "pinned"],
	["browserType", "vrOverlayKey"],
	["createflags"],
	[
		"browser",
		// Note: this isn't anywhere in js, but BPM main menu, QAM &
		// notification toasts get created with that.
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
const vecIcons = [
	<IconsModule.Checkmark />,
	<IconsModule.Library />,
	<IconsModule.Flags />,
	<IconsModule.Keyboard />,
	<IconsModule.Keyboard />,
];

const g_pLogger = new CLog("settingsdialog");
const pSettingsClasses = findModule((e) => e.SettingsDialogBodyFade);

// Globals for params
const g_setFlags = new Set<number>();

const EnumToObject = (e: any) =>
	Object.entries(e).filter((e) => typeof e[1] === "number") as EnumObject_t;

const EnumToDropdown = (e: any) =>
	EnumToObject(e).map((e) => ({
		data: e[1],
		label: e[0],
	})) as SingleDropdownOption[];

const SettingsDialogBody = ({ children }) => (
	<DialogBody className={pSettingsClasses.SettingsDialogBodyFade}>
		{children}
	</DialogBody>
);

const SettingsDialogSubHeader = ({ children }) => (
	<div className="SettingsDialogSubHeader">{children}</div>
);

interface ParamProps {
	name: string;
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

	ShowWarningDialog(value: S) {
		const strDescription = Localize(
			"#ChangeWindowParams_Dialog_WarningDescription",
		);
		const strTitle = Localize("#ChangeWindowParams_Dialog_WarningTitle");
		const onOK = () => {
			this.ChangeParam(value);
		};

		showModal(
			<ConfirmModal
				bDestructiveWarning
				strTitle={strTitle}
				strDescription={<BBCodeParser text={strDescription} />}
				onOK={onOK}
			/>,
			pluginSelf.pSettingsDialog,
			{ bNeverPopOut: true },
		);
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
	}

	render() {
		const { name } = this.props;
		const token = `#ChangeWindowParams_ParamDesc_${name}`;
		// TODO desc in dropdown? idk

		return (
			<ParamField label={name} description={token}>
				<Dropdown
					contextMenuPositionOptions={{ bMatchWidth: false }}
					onChange={(value) => this.ChangeParam(value)}
					rgOptions={EnumToDropdown(mapParamEnums[name])}
					selectedOption={this.state.value.label}
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
		const param = this.m_pSettings.params[this.props.name] as number[];

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
		const bShowDialog = value && k_pWarners[name]?.some((e) => member === e);
		if (bShowDialog) {
			this.ShowWarningDialog(value);
			return;
		}

		this.ChangeParam(value);
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

export function SettingsDialog() {
	// Keep in sync with EParamType, too
	const vecContents: PageMapFn_t[] = [
		(param) => <BoolParam name={param} />,
		(param) => <EnumParam name={param} />,
		(param) => (
			<DialogControlsSection>
				<SettingsDialogSubHeader>{param}</SettingsDialogSubHeader>
				{EnumToObject(mapParamFlags[param]).map(([member, flag]) => (
					<FlagParam name={param} member={member} flag={flag} />
				))}
			</DialogControlsSection>
		),
		(param) => <TextParam bNumeric name={param} />,
		(param) => <TextParam name={param} />,
	];
	const vecPages: SidebarNavigationPage[] = k_vecParamTypes.map((type, i) => ({
		icon: vecIcons[i],
		title: Localize(`#ChangeWindowParams_Tab_${type}`),
		content: (
			<SettingsDialogBody>
				{vecWindowParams[i].map((param) => vecContents[i](param))}
			</SettingsDialogBody>
		),
	}));
	const strTitle = Localize("#ChangeWindowParams_Dialog_SettingsTitle");

	return (
		<ModalPosition>
			<SidebarNavigation pages={vecPages} title={strTitle} />
		</ModalPosition>
	);
}
