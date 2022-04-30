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
 * @property {"auto" | boolean} [generateCoverageMap] `"auto"` to look at command line flags for this option, or `true|false` to force enable or disable coverage map generation. Defaults to `"auto"`.
 * @property {string} [coverageMapOutPath] When set, writes coverage map data to this directory.
 * [more info about coverage maps](https://github.com/jespertheend/fake-imports#coverage)
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
   * // Creating a second importer will make seperate instances of all the scripts.
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
   * @param {string} url
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
   * @param {string | URL} url should be relative to the `importMeta` argument provided in the {@link constructor}.
   * @param {string | ModuleImplementation} moduleImplementation The code to replace the imported content with.
   */
  fakeModule(url, moduleImplementation) {
    this.#resolver.registerFakeModule(url, moduleImplementation);
  }

  /**
   * Fakes a module with the content of another file. This is almost the same as fetching content
   * from a file and passing it to {@link fakeModule}, except that relative imports of the new
   * file are maintained.
   *
   * ## Usage
   * Say you have the following files:
   *
   * ```js
   * // /foo.js
   * import {bar} from "./bar.js";
   *
   * // /long/path/to/fakeFoo.js
   * import {fakeBar} from "./fakeBar.js";
   * ```
   *
   * You can point `/foo.js` to the new path using
   * ```
   * importer.redirectModule("/foo.js", "/long/path/to/fakeFoo.js");
   * ```
   *
   * This will ensure that `fakeBar.js` is imported from `/long/path/to/fakeBar.js`.
   *
   * #### Using fakeModule()
   *
   * If you were to try this with `fakeModule()` like so:
   * ```js
   * const fakeFoo = await fetch("/long/path/to/fakeFoo.js");
   * importer.fakeModule("/foo.js", await fakeFoo.text());
   * ```
   *
   * You would run into errors, because like this `fakeBar.js` would be imported from `/fakeBar.js`,
   * which doesn't exist.
   *
   * @param {string | URL} url The old url you wish to replace.
   * Should be relative to the `importMeta` argument provided in the {@link constructor}.
   * @param {string | URL} newUrl The new url relative to the `importMeta` argument provided in the {@link constructor}.
   */
  redirectModule(url, newUrl) {
    this.#resolver.registerRedirectModule(url, newUrl);
  }

  /**
   * Use this to set the import map of the importer.
   * You may only call this once, and only before making any imports.
   * You can either pass a string that points to the import map (remote or on disk),
   * or you can pass an import map object directly.
   *
   * ## Usage
   * ```js
   * const importer1 = new Importer(import.meta.url);
   * importer1.setImportMap("../import-map.json"); // import relatively to the current file
   *
   * const importer2 = new Importer(import.meta.url);
   * importer2.setImportMap("https://example.com/import-map.json"); // import from a remote location
   *
   * const importer3 = new Importer(import.meta.url);
   * importer3.setImportMap({
   *  "imports": {
   *    "./foo.js": "https://example.com/foo.js",
   *    "./bar.js": "https://example.com/bar.js",
   *  },
   * });
   * ```
   * @param {string | URL | import("./src/importMapParser.js").ImportMapData} importMap
   */
  setImportMap(importMap) {
    this.#resolver.setImportMap(importMap);
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
}
