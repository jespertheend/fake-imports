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
 * @property {string | URL | import("https://deno.land/x/import_maps@v0.1.1/mod.js").ImportMapData} [importMap] Use this to set the import map of the importer.
 * You may only call this once, and only before making any imports.
 * You can either pass a string that points to the import map (remote or on disk),
 * or you can pass an import map object directly.
 *
 * ## Usage
 * ```js
 * const importer1 = new Importer(import.meta.url, {
 *   importMap: "../import-map.json", // import relatively to the current file
 * });
 *
 * const importer2 = new Importer(import.meta.url, {
 *   importMap: "https://example.com/import-map.json", // import from a remote location
 * });
 *
 * const importer3 = new Importer(import.meta.url, {
 *   importMap: {
 *     "imports": {
 *       "./foo.js": "https://example.com/foo.js",
 *       "./bar.js": "https://example.com/bar.js",
 *     },
 *   },
 * });
 * ```
 * @property {boolean} [makeImportMapEntriesReal] When set to true (which is the default) all the entries
 * in the import map will be marked as real with `exactMatch: true`. The
 * assumption is made that the import map you have provided is the same import
 * map as the one you are already using in your environment. In this case
 * leaving this set as `true` should be fine. But if you haven't set an import
 * map, you should probably set this to `false`.
 * For more info about marking modules as real, see {@linkcode Importer.makeReal}.
 */

/**
 * @typedef MakeRealOptions
 * @property {boolean} [exactMatch] If set to true (default is false), import
 * statement is left as is when they exactly match the provided url.
 * This causes the module to be loaded from the original URL.
 * Otherwise the import statements will be resolved and replaced according to the
 * import map provided in the `Importer` constructor.
 *
 * This is useful if you have an import map set up outside of the importer, e.g.
 * through Deno's `--import-map` argument, or using <script type="importmap"> in
 * browsers. If your environment doesn't support import maps, or you simply
 * haven't set one, you will probably have to set this to false. Otherwise you
 * will likely get an error when trying to load the module as a bare specifier.
 *
 * Note that for this to work you have to provide the exact same url as imported
 * by any parent modules. So providing a path relative to your `import.meta.url`
 * won't work. But you generally only want to use this for bare specifiers, such
 * as `"lodash"` or `"moment"`, since all faked modules are impored as blob urls.
 * Meaning imports such as `"./relative/path/to/file.js"` will not work.
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
		let deno = null;
		if ("Deno" in globalThis) {
			env = "deno";
			deno = Deno;
		}
		/** @type {string[]} */
		let args = [];
		if (env === "deno") {
			args = Deno.args;
		}
		this.#resolver = new ImportResolver(importMeta, options, {
			env,
			args,
			deno,
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
	 * Replaces a module with the content of another file.
	 * This has the added benefit that any imports within the new file will be resolved relative to its new path.
	 *
	 * This is almost the same as fetching content from a file and passing it to {@link fakeModule},
	 * except that imports of the new file are resolved relative to the new location.
	 *
	 * ## Usage
	 * Say you have the file `foo.js`:
	 *
	 * ```js
	 * export const foo = "foo";
	 * ```
	 *
	 * You can point `/foo.js` to another path using:
	 * ```js
	 * importer.redirectModule("/foo.js", "/long/path/to/fakeFoo.js");
	 * ```
	 *
	 * Now if `fakeFoo.js` contains an import like:
	 * ```js
	 * import {bar} from "./bar.js";
	 * ```
	 * then `bar` will be imported from `/long/path/to/bar.js`.
	 *
	 * If you want access to the original exports, redirected modules can simply import 'themselves' from the old url:
	 * ```js
	 * import {foo} from "../../../foo.js";
	 * ```
	 *
	 * @param {string | URL} url The old url you wish to replace.
	 * Should be relative to the `importMeta` argument provided in the {@link constructor}.
	 * @param {string | URL} newUrl The new url relative to the `importMeta` argument provided in the {@link constructor}.
	 */
	redirectModule(url, newUrl) {
		this.#resolver.registerRedirectModule(url, newUrl);
	}

	/**
	 * Marks a specific module as needing to be imported by the real url, rather
	 * than a generated blob url. Though keep in mind that this will prevent
	 * `fakeModule` or `redirectModule` calls from having any effect on the module.
	 *
	 * This is useful if the module imports a lot of dependencies, as this
	 * prevents lots of blob urls from being created, which could potentially
	 * be very slow.
	 * This is also useful when your module creates instances that you want to
	 * test for using `instanceof`. For example, say you have a module that
	 * exports an instance of `Foo` like so:
	 *
	 * ```js
	 * import {Foo} from "./Foo.js";
	 * export const instance = new Foo();
	 * ```
	 *
	 * If you then import this module via a `new Importer()`, but import `Foo` via
	 * regular imports:
	 *
	 * ```js
	 * import {Foo} from "./Foo.js";
	 * const importer = new Importer(import.meta.url);
	 * const {instance} = await importer.import("./instance.js");
	 * ```
	 *
	 * and then test if `instance` is an instance of `Foo`:
	 *
	 * ```js
	 * assert(instance instanceof Foo);
	 * ```
	 *
	 * You'll get an error, because the two instances were actually created from
	 * a different class.
	 *
	 * To work around this, mark the module as real, so that internally no blob
	 * url is created for it:
	 *
	 * ```js
	 * importer.makeReal("./Foo.js");
	 * ```
	 *
	 * This way `instance.js` is still replaced with a blob url, but `Foo.js` is
	 * not.
	 * @param {string} url
	 * @param {MakeRealOptions} [options]
	 */
	makeReal(url, options) {
		this.#resolver.makeReal(url, options);
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
