import {
	AreTwoArraysEqual,
	EnumToDropdown,
	EnumToObject,
	WillApplyWindowOptions,
} from "@/utils";

import { describe, expect, it } from "bun:test";

enum ETest {
	One,
	Two,
}

describe("AreTwoArraysEqual", () => {
	it("returns true on equal arrays", () => {
		const a = [1, 2, 3];
		const b = [1, 2, 3];
		expect(AreTwoArraysEqual(a, b)).toBe(true);
	});

	it("returns false on non-equal arrays", () => {
		const a = [1, 2];
		const b = [1, 2, 3];
		expect(AreTwoArraysEqual(a, b)).toBe(false);
	});
});

describe("EnumToDropdown", () => {
	it("converts an enum to a SingleDropdownOption[]", () => {
		expect(EnumToDropdown(ETest)).toEqual([
			{ data: 0, label: "One" },
			{ data: 1, label: "Two" },
		]);
	});
});

describe("EnumToObject", () => {
	it("converts an enum to an EnumObject_t", () => {
		expect(EnumToObject(ETest)).toEqual([
			["One", 0],
			["Two", 1],
		]);
	});
});

describe("WillApplyWindowOptions", () => {
	it("applies options to ordinary windows regardless of include settings", () => {
		const name = "SP Desktop_uid0";
		expect(WillApplyWindowOptions(name, 0, {})).toBe(true);
		expect(
			WillApplyWindowOptions(name, 0, {
				IncludeMenus: true,
				IncludeNotifications: true,
				IncludeOverlay: true,
			}),
		).toBe(true);
	});

	it("includes menus only when IncludeMenus is enabled", () => {
		const name = "contextmenu_1";
		expect(WillApplyWindowOptions(name, 0, {})).toBe(false);
		expect(WillApplyWindowOptions(name, 0, { IncludeMenus: true })).toBe(true);
	});

	it("includes notifications only when IncludeNotifications is enabled", () => {
		const name = "notificationtoasts_1";
		expect(WillApplyWindowOptions(name, 0, {})).toBe(false);
		expect(
			WillApplyWindowOptions(name, 0, { IncludeNotifications: true }),
		).toBe(true);
	});

	it("includes overlays and windows with a parent PID only when IncludeOverlay is enabled", () => {
		expect(WillApplyWindowOptions("desktopoverlay_1", 0, {})).toBe(false);
		expect(
			WillApplyWindowOptions("desktopoverlay_1", 0, { IncludeOverlay: true }),
		).toBe(true);
		expect(WillApplyWindowOptions("popup_1", 42, {})).toBe(false);
		expect(
			WillApplyWindowOptions("popup_1", 42, { IncludeOverlay: true }),
		).toBe(true);
	});

	it("uses any enabled matching include option for overlapping window types", () => {
		expect(
			WillApplyWindowOptions("contextmenu_1", 42, {
				IncludeOverlay: true,
			}),
		).toBe(true);
	});
});
