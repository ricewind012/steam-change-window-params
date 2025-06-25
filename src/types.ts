export type WindowParam_t =
	| "browser"
	| "browserType"
	/**
	 * @note This isn't anywhere in js, but BPM main menu, QAM & notification toasts
	 * get created with that.
	 */
	| "browserviewpopup"
	| "centerOnBrowserID"
	| "createflags"
	| "hwndParent"
	| "minheight"
	| "minwidth"
	| "modal"
	| "openerid"
	| "parentcontainerpopupid"
	| "parentpopup"
	| "pinned"
	| "requestid"
	| "restoredetails"
	| "screenavailheight"
	| "screenavailwidth"
	| "useragent"
	| "vrOverlayKey";

export type WindowParamMap_t<T> = Partial<Record<WindowParam_t, T>>;
