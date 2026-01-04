/** biome-ignore-all lint/suspicious/noExplicitAny: intentional */

import {
	type ShowModalProps,
	type SingleDropdownOption,
	showModal,
} from "@steambrew/client";
import type { ReactNode } from "react";

type EnumObject_t = [string, number][];

export function AreTwoArraysEqual(lhs: any[], rhs: any[]) {
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

export const EnumToDropdown = (e: any) =>
	EnumToObject(e).map((e) => ({
		data: e[1],
		label: e[0],
	})) as SingleDropdownOption[];

export const EnumToObject = (e: any) =>
	Object.entries(e).filter((e) => typeof e[1] === "number") as EnumObject_t;

/**
 * Cool wrapper for {@link showModal} that doesn't require a parent.
 */
export function ShowDialog(modal: ReactNode, props: ShowModalProps) {
	const wnd = SteamUIStore.WindowStore.MainWindowInstance.BrowserWindow;
	return showModal(modal, wnd, props);
}
