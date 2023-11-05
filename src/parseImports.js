import { getCommentLocations } from "./parseComments.js";

/**
 * @typedef {Object} ImportLocation
 * @property {number} start The character index of the start of the specifier string.
 * @property {number} length The length of the specifier string.
 * @property {string} url The raw import specifier string as it exists in the file.
 */

/**
 * Parses a match and adds it to the imports set if it contains an import specifier.
 * @param {RegExpMatchArray} match
 * @param {Set<ImportLocation>} imports
 */
function parseMatch(match, imports) {
	const url = match.groups?.url;
	// @ts-expect-error indices does not exist but all browsers support it
	const start = match.indices.groups?.url[0];
	if (url && start !== undefined) {
		imports.add({
			start,
			length: url.length,
			url,
		});
	}
}

/**
 * Checks brackets and quotes in a string to see if all of them have been closed.
 * Only checks counts, so '[ ( ] )' will return false.
 * @param {string} str
 */
function containsUnclosedRange(str) {
	/** @param {string} char */
	function countChar(char) {
		const re = new RegExp("\\" + char, "g");
		return (str.match(re) || []).length;
	}

	for (const quoteType of ['"', "'", "`"]) {
		if (countChar(quoteType) % 2 == 1) return true;
	}
	for (const [open, close] of ["[]", "()", "{}"]) {
		const openCount = countChar(open);
		const closeCount = countChar(close);
		if (openCount != closeCount) return true;
	}

	return false;
}

/**
 * Takes a script source and returns positions of where import strings are
 * located in the source.
 * @param {string} scriptSource
 */
export function parseImports(scriptSource) {
	/** @type {Set<ImportLocation>} */
	const imports = new Set();
	const staticImportRegex = /(?:^|;)\s*import[\s\S]+?["'](?<url>.+?)["']/gmd;
	for (const match of scriptSource.matchAll(staticImportRegex)) {
		parseMatch(match, imports);
	}
	const staticReExportRegex = /(?:^|;)\s*export(?<decl>[\s\S]+?)from\s+["'](?<url>.+?)["']/gmd;
	for (const match of scriptSource.matchAll(staticReExportRegex)) {
		// If the declaration part contains an unclosed range, then the 'from ""' part
		// of the import is likely in a string, or a variable inside a closure.
		// We'll just assume it isn't an export statement in that case.
		const decl = match.groups?.decl;
		if (!decl || containsUnclosedRange(decl)) continue;
		parseMatch(match, imports);
	}
	const dynamicImportRegex = /import\s*?\(\s*?["'](?<url>.+)["']\s*?\)/gmd;
	for (const match of scriptSource.matchAll(dynamicImportRegex)) {
		parseMatch(match, imports);
	}

	const commentLocation = getCommentLocations(scriptSource);

	/** @type {ImportLocation[]} */
	const overlappingImports = [];
	for (const importLocation of imports) {
		for (const comment of commentLocation) {
			const importStart = importLocation.start;
			const importEnd = importLocation.start + importLocation.length;
			// If import overlaps with the comment
			if (importEnd > comment.start && importStart < comment.end) {
				overlappingImports.push(importLocation);
			}
		}
	}

	for (const overlapping of overlappingImports) {
		imports.delete(overlapping);
	}

	return Array.from(imports);
}
