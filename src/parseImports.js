/**
 * @typedef {Object} ImportLocation
 * @property {number} start
 * @property {number} length
 * @property {string} url
 */

/**
 * Takes a script source and returns positions of where import strings are
 * located in the source.
 * @param {string} scriptSource
 */
export function parseImports(scriptSource) {
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
