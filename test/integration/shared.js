import { assertEquals } from "asserts";
import { toFileUrl } from "https://deno.land/std@0.119.0/path/mod.ts";
import { dirname, resolve } from "https://deno.land/std@0.119.0/path/mod.ts";

/**
 * @typedef {Object} SetupScriptTempDirResult
 * @property {string} dirPath The path to the created directory
 * @property {string} basePath The path to the created directory in file:// format
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
    const filePath = resolve(dirPath, fileName);
    const promise = (async () => {
      await Deno.mkdir(dirname(filePath), { recursive: true });
      await Deno.writeTextFile(filePath, scriptContent);
    })();
    promises.push(promise);
  }
  await Promise.all(promises);
  const cleanup = async () => {
    await Deno.remove(dirPath, { recursive: true });
  };
  const basePath = toFileUrl(dirPath) + "/";
  return { basePath, dirPath, cleanup };
}

export async function simpleReplacementDir() {
  return await setupScriptTempDir({
    "main.js": `
      import {replaced} from "./replaced.js";
      export {replaced};
    `,
    "replaced.js": `
      export const replaced = "not replaced";
    `,
  }, {
    prefix: "simple_replacement_test",
  });
}

/**
 * Counts the number of files (exluding directories) in the given directory and
 * checks if the number is equal to the expected number.
 * @param {string} path
 * @param {number} count
 */
export async function assertFileCount(path, count) {
  let fileCount = 0;
  for await (const file of Deno.readDir(path)) {
    if (!file.isFile) continue;
    fileCount++;
  }
  assertEquals(fileCount, count);
}
