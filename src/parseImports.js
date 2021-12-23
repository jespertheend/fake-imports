/**
 * @typedef {Object} ImportLocation
 * @property {number} start
 * @property {number} length
 * @property {string} url
 */

/**
 * @param {string} scriptSource
 */
export function parseImports(scriptSource) {
	// deno-lint-ignore no-invalid-regexp no-empty-character-class
	const re = /import[\s\S]+?["'](?<url>.+)["']/gd;
	/** @type {ImportLocation[]} */
	const imports = [];
	for (const match of scriptSource.matchAll(re)) {
		const url = match.groups?.url;
		// @ts-ignore indices does not exist but all browsers support it
		const start = match.indices.groups?.url[0];
		if (url && start !== undefined) {
			imports.push({
				start,
				length: url.length,
				url,
			});
		}
	}
	return imports;
}
