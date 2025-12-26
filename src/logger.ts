import { LOG_STYLE, PLUGIN_NAME } from "./consts";

export class CLog {
	public m_strScope: string;

	constructor(strScope: string) {
		this.m_strScope = strScope;
	}

	// biome-ignore lint/suspicious/noExplicitAny: console.log() args
	#Print(strMethod: string, strFormat: string, ...args: any[]) {
		console[strMethod](
			`%c${PLUGIN_NAME}%c${this.m_strScope}%c ${strFormat}`,
			`${LOG_STYLE}; background-color: black; color: white`,
			`${LOG_STYLE}; background-color: #404040; color: #eee`,
			"",
			...args,
		);
	}

	// biome-ignore lint/suspicious/noExplicitAny: console.log() args
	Log(strFormat: string, ...args: any[]) {
		this.#Print("log", strFormat, ...args);
	}

	// biome-ignore lint/suspicious/noExplicitAny: console.log() args
	Warn(strFormat: string, ...args: any[]) {
		this.#Print("warn", strFormat, ...args);
	}

	// biome-ignore lint/suspicious/noExplicitAny: console.log() args
	Error(strFormat: string, ...args: any[]) {
		this.#Print("error", strFormat, ...args);
	}

	// biome-ignore lint/suspicious/noExplicitAny: console.log() args
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
		this.m_unDate = Date.now();
	}

	TimeEnd() {
		const unCurrentDate = Date.now();
		this.Log(
			"%s: took %o seconds",
			this.m_strLabel,
			(unCurrentDate - this.m_unDate) / 1000,
		);
	}
}
