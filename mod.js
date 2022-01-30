import { ImportResolver } from "./src/ImportResolver.js";

/**
 * @typedef OriginalModuleData
 * @property {string} url
 * @property {string} fullContent The full script content fetched from the original url without any modifications.
 */

/**
 * @typedef {(() => string) | ((original: OriginalModuleData) => string)} ModuleImplementation
 */

/**
 * @typedef ImporterOptions
 * @property {string} [coverageMapOutPath] When set, writes coverage map data to this directory.
 * [more info about coverage maps](https://github.com/jespertheend/fake-imports#coverage)
 * @property {number} [forceCoverageMapWriteTimeout] Forces coverage map data to wait for this amount
 * of milliseconds before writing to disk. Useful for finding flaky tests. [more info](https://github.com/jespertheend/fake-imports#waiting-for-writes-to-finish)
 */

/**
 * @typedef CoverageMapEntry
 * @property {string} replacedUrl
 * @property {string} originalUrl
 * @property {import("./src/computeDiffOffsets.js").DiffOffsets} diffOffsets
 */

export class Importer {
  #resolver;

  /**
   * Creates a new Importer instance. Creating multiple instances is supported
   * and will cause scripts to get loaded in a somewhat isolated state. They'll
   * be isolated in that modifications to a script imported from one importer
   * do not affect other importers. However, if a script makes modifications
   * to the global scope, this is not the case.
   *
   * For instance:
   * ### foo.js
   * ```js
   * const someObject = { modified: false };
   * export default someObject;
   * ```
   *
   * ### modifyIt.js
   * ```js
   * import { someObject } from "foo.js";
   * someObject.modified = true;
   * ```
   *
   * ### run.js
   * ```js
   * const importer1 = new Importer(import.meta.url);
   * await importer1.import("./modifyIt.js");
   * const result1 = await importer1.import("./foo.js");
   * console.log(result1.modified); // true
   *
   * const importer2 = new Importer(import.meta.url);
   * const result2 = await importer2.import("./foo.js");
   * console.log(result2.modified); // false
   * ```
   * @param {string | URL} importMeta
   * @param {ImporterOptions} [options]
   */
  constructor(importMeta, options = {}) {
    /** @type {import("./src/ImportResolver.js").Environment} */
    let env = "browser";
    if ("Deno" in globalThis) {
      env = "deno";
    }
    /** @type {string[]} */
    let args = [];
    if (env === "deno") {
      args = Deno.args;
    }
    this.#resolver = new ImportResolver(importMeta, options, {
      env,
      args,
      deno: Deno,
    });
  }

  /**
   * Import a script. Similar to using the
   * [dynamic `import()` statement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#dynamic_imports).
   * Except with the faked modules applied.
   * @template T
   * @param {string | URL} url
   * @returns {Promise<T>}
   */
  async import(url) {
    return await this.#resolver.import(url);
  }

  /**
   * Fakes a module. You can either pass a string or a function that returns a string.
   *
   * ## Usage
   * If you just want to replace the entire content of a module, you can pass a string:
   * ```js
   * importer.fakeModule("./module.js", "export 'replaced'");
   * ```
   *
   * If you want access to the original exports, faked modules can simply import themselves:
   * ```js
   * importer.fakeModule("./module.js", `
   *  import { original } from "./module.js";
   *  // Do something with original
   *  export { original };
   * `);
   * ```
   *
   * For more complex cases, you can pass a function that receives the original module data:
   * ```js
   * importer.fakeModule("./module.js", original => {
   *  return original.fullContent.replace("foo", "bar");
   * });
   * ```
   * @param {string | URL} url should be relative to the `importMeta` argument
   * provided in the {@link constructor}.
   * @param {string | ModuleImplementation} moduleImplementation The code to replace the imported content with.
   */
  fakeModule(url, moduleImplementation) {
    this.#resolver.registerFakeModule(url, moduleImplementation);
  }

  /**
   * Gets all coverage map data from all modules imported by this importer.
   *
   * [more info about coverage maps](https://github.com/jespertheend/fake-imports#coverage)
   */
  getCoverageMap() {
    return this.#resolver.getCoverageMap();
  }

  /**
   * Fires when a new module is imported and provides coverage map data for
   * this import.
   *
   * [more info about coverage maps](https://github.com/jespertheend/fake-imports#coverage)
   * @param {(entry: CoverageMapEntry) => void} cb
   */
  onCoverageMapEntryAdded(cb) {
    this.#resolver.onCoverageMapEntryAdded(cb);
  }

  /**
   * @param {(entry: CoverageMapEntry) => void} cb
   */
  removeOnCoverageMapEntryAdded(cb) {
    this.#resolver.removeOnCoverageMapEntryAdded(cb);
  }

  /**
   * Resolves when all coverage map data has been written to disk.
   *
   * [more info](https://github.com/jespertheend/fake-imports#waiting-for-writes-to-finish)
   */
  async finishCoverageMapWrites() {
    await this.#resolver.finishCoverageMapWrites();
  }
}
