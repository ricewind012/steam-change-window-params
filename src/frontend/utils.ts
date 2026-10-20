import type { SingleDropdownOption } from "millennium";

import type { Settings } from "./settings";

type NumericEnum_t<T extends object> = {
	[K in Extract<keyof T, string>]: number;
};
type EnumObject_t<T extends object> = [Extract<keyof T, string>, T[keyof T]][];

/**
 * *Naïvely* compares two arrays.
 *
 * @returns `false` for missing values, non-arrays, or arrays of different
 * lengths.
 */
export function AreTwoArraysEqual<T>(lhs: T[], rhs: T[]) {
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
 * Converts a numeric TypeScript enum into `<Dropdown />` options.
 */
export function EnumToDropdown<T extends NumericEnum_t<T>>(e: T) {
	return EnumToObject(e).map((e) => ({
		data: e[1],
		label: e[0],
	})) as SingleDropdownOption[];
}

/**
 * `enum EHello { Wat, Ever }` -> `[["Wat", 0], ["Ever", 1]]`
 */
export function EnumToObject<T extends NumericEnum_t<T>>(e: T) {
	return Object.entries(e).filter(
		(e) => typeof e[1] === "number",
	) as EnumObject_t<T>;
}

/**
 * @param strName Internal window name.
 * @param unPID Parent process ID.
 * @param options
 */
export function WillApplyWindowOptions(
	strName: string,
	unPID: number,
	// this is an arg only for tests lol
	options: Settings["options"],
) {
	const bIsMenu = strName.startsWith("contextmenu_");
	const bIsNotification = strName.startsWith("notificationtoasts_");
	const bIsOverlay = strName.startsWith("desktopoverlay_");
	const bIsOverlayParent = unPID !== 0;

	const bIsSpecialWindow =
		bIsMenu || bIsNotification || bIsOverlay || bIsOverlayParent;
	if (!bIsSpecialWindow) {
		return true;
	}

	return (
		(options.IncludeMenus && bIsMenu) ||
		(options.IncludeNotifications && bIsNotification) ||
		(options.IncludeOverlay && (bIsOverlay || bIsOverlayParent)) ||
		false
	);
}
