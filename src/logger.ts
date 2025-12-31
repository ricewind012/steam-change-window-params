/** biome-ignore-all lint/suspicious/noExplicitAny: console.log() args */

import { PLUGIN_NAME } from "./consts";

const LOG_STYLE = "padding: 0 1ch";

export class CLog {
	private m_strScope: string;

	constructor(strScope: string) {
		this.m_strScope = strScope;
	}

	private Print(strMethod: string, strFormat: string, ...args: any[]) {
		console[strMethod](
			`%c${PLUGIN_NAME}%c${this.m_strScope}%c ${strFormat}`,
			`${LOG_STYLE}; background-color: #fff; color: #000`,
			`${LOG_STYLE}; background-color: #000; color: #fff`,
			"",
			...args,
		);
	}

	Log(strFormat: string, ...args: any[]) {
		this.Print("log", strFormat, ...args);
	}

	Warn(strFormat: string, ...args: any[]) {
		this.Print("warn", strFormat, ...args);
	}

	Error(strFormat: string, ...args: any[]) {
		this.Print("error", strFormat, ...args);
	}

	Assert(bCondition: boolean, strFormat: string, ...args: any[]) {
		if (!bCondition) {
			this.Error(`Assertion failed: ${strFormat}`, ...args);
		}
	}
}

export class CLogTime extends CLog {
	private m_strLabel: string;
	private m_unStart: number;

	constructor(strScope: string, strLabel: string) {
		super(strScope);
		this.m_strLabel = strLabel;
	}

	TimeStart() {
		this.m_unStart = Date.now();
	}

	TimeEnd() {
		const unEnd = Date.now();
		this.Log(
			"%s: took %o seconds",
			this.m_strLabel,
			(unEnd - this.m_unStart) / 1000,
		);
	}
}
