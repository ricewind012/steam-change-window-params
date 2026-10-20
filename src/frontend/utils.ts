/** biome-ignore-all lint/suspicious/noExplicitAny: intentional */

import type { SingleDropdownOption } from "millennium";

import type { Settings } from "./settings";

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

export function WillApplyWindowOptions(
	strName: string,
	unPID: number,
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
