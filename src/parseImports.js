import { getCommentLocations } from "./parseComments.js";

/**
 * @typedef {Object} ImportLocation
 * @property {number} start
 * @property {number} length
 * @property {string} url
 */

/**
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
  const staticReExportRegex =
    /(?:^|;)\s*export[\s\S]+?from\s+["'](?<url>.+?)["']/gmd;
  for (const match of scriptSource.matchAll(staticReExportRegex)) {
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
