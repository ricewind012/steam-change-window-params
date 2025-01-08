import plugin from "../plugin.json";

const k_bShouldLog = true;
const k_strLogStyle = "padding: 0 1ch";
const k_strPluginName = plugin.name;

export class CLog {
	public m_strScope: string;

	constructor(strScope: string) {
		this.m_strScope = strScope;
	}

	#Print(strMethod: string, strFormat: string, ...args: any[]) {
		if (!k_bShouldLog) {
			return;
		}

		console[strMethod](
			`%c${k_strPluginName}%c${this.m_strScope}%c ${strFormat}`,
			`${k_strLogStyle}; background-color: black; color: white`,
			`${k_strLogStyle}; background-color: #404040; color: #eee`,
			"",
			...args,
		);
	}

	Log(strFormat: string, ...args: any[]) {
		this.#Print("log", strFormat, ...args);
	}

	Warn(strFormat: string, ...args: any[]) {
		this.#Print("warn", strFormat, ...args);
	}

	Error(strFormat: string, ...args: any[]) {
		this.#Print("error", strFormat, ...args);
	}

	Assert(bAssertion: boolean, strFormat: string, ...args: any[]) {
		if (bAssertion) {
			return;
		}

		this.Error(`Assertion failed: ${strFormat}`, ...args);
	}
}

export class CLogTime extends CLog {
	m_strLabel: string;
	m_unDate: number;

	constructor(strScope: string, strLabel: string) {
		super(strScope);
		this.m_strLabel = strLabel;
	}

	TimeStart() {
		this.m_unDate = Number(new Date());
	}

	TimeEnd() {
		const unCurrentDate = Number(new Date());
		this.Log(
			"%s: took %o seconds",
			this.m_strLabel,
			(unCurrentDate - this.m_unDate) / 1000,
		);
	}
}
