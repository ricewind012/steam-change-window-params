/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: Lodash template */

/** @type {import("semantic-release").GlobalConfig} */
export default {
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@semantic-release/npm",
		"@semantic-release/github",
		[
			"@ricewind012/semantic-release-millennium",
			{
				prCreationMode: "open-pr",
			},
		],
		[
			"@semantic-release/git",
			{
				assets: ["millennium.toml", "package.json", "package-lock.json"],
			},
		],
	],
};
