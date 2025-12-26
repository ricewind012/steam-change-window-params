import plugin from "../plugin.json";

export const LOG_STYLE = "padding: 0 1ch";
export const PLUGIN_NAME = plugin.name;
export const PLUGIN_PATH = (() => {
	const script = document.querySelector(
		`script[src*="${PLUGIN_NAME}"]`,
	) as HTMLScriptElement;
	const { href } = new URL(script.src);

	return href.replace(/\.millennium\/Dist\/index.js$/, "");
})();
