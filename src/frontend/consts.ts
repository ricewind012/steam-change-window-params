export const PLUGIN_NAME = "steam-change-window-params";
export const PLUGIN_PATH = (() => {
	const script = document.querySelector(
		`script[src*="${PLUGIN_NAME}"]`,
	) as HTMLScriptElement;
	const { href } = new URL(script.src);

	return href.replace(/\.millennium\/Dist\/index.js$/, "");
})();
