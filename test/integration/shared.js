import { join } from "https://deno.land/std@0.119.0/path/mod.ts";

/**
 * @typedef {Object} SetupScriptTempDirResult
 * @property {string} dirPath
 * @property {() => Promise<void>} cleanup
 */

/**
 * Creates a temp dir and creates the specified script files.
 * Usage:
 * ```js
 * const {dirPath} = await setupScriptTempDir({
 *   "script1.js": "console.log('Hello World!');",
 *   "script2.js": "console.log('Hello World!');",
 * });
 * ```
 * @param {Object<string, string>} scriptFiles
 * @returns {Promise<SetupScriptTempDirResult>}
 */
export async function setupScriptTempDir(scriptFiles, {
  prefix = "",
  suffix = "",
} = {}) {
  const dirPath = await Deno.makeTempDir({ prefix, suffix });
  const promises = [];
  for (const [fileName, scriptContent] of Object.entries(scriptFiles)) {
    const filePath = join(dirPath, fileName);
    const promise = Deno.writeTextFile(filePath, scriptContent);
    promises.push(promise);
  }
  await Promise.all(promises);
  const cleanup = async () => {
    await Deno.remove(dirPath, { recursive: true });
  };
  return { dirPath, cleanup };
}
