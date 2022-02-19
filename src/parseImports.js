/**
 * @typedef {Object} ImportLocation
 * @property {number} start
 * @property {number} length
 * @property {string} url
 */

/**
 * @param {RegExpMatchArray} match
 * @param {ImportLocation[]} imports
 */
function parseMatch(match, imports) {
  const url = match.groups?.url;
  // @ts-expect-error indices does not exist but all browsers support it
  const start = match.indices.groups?.url[0];
  if (url && start !== undefined) {
    imports.push({
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
  /** @type {ImportLocation[]} */
  const imports = [];
  const staticImportRegex = /(?:^|;)\s*import[\s\S]+?["'](?<url>.+?)["']/gmd;
  for (const match of scriptSource.matchAll(staticImportRegex)) {
    parseMatch(match, imports);
  }
  const dynamicImportRegex = /import\s*?\(\s*?["'](?<url>.+)["']\s*?\)/gmd;
  for (const match of scriptSource.matchAll(dynamicImportRegex)) {
    parseMatch(match, imports);
  }
  return imports;
}
