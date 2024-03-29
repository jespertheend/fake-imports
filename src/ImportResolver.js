/**
 * @fileoverview
 * An ImportResolver is responsible for keeping track of imported and faked
 * modules, as well as options and command line arguments. It is essentially the
 * entry point of the library.
 *
 * An ImportResolver is almost the same as the `Importer` exported in
 * mod.js, except that it has some extra functionality available that should
 * normally not be exposed to users of the library. This allows for easier
 * unit tests for different arguments and environments.
 */

import { fromFileUrl, resolve } from "https://deno.land/std@0.121.0/path/mod.ts";
import { CollectedImportFake } from "./CollectedImportFake.js";
import { CollectedImportFetch } from "./CollectedImportFetch.js";
import { createEmptyImportMap, parseImportMap, resolveModuleSpecifier } from "https://deno.land/x/import_maps@v0.1.1/mod.js";
import { fetchWithErrorHandling } from "./shared.js";
import { getRelativePath } from "./getRelativePath.js";

/** @typedef {"browser" | "deno"} Environment */

/**
 * @typedef RuntimeData
 * @property {Environment} [env]
 * @property {string[]} [args]
 * @property {Deno?} [deno]
 */

/**
 * @typedef ForcedRealData
 * @property {boolean} exactMatch
 */

const COVERAGE_MAP_ARG = "--fi-coverage-map=";

export class ImportResolver {
	#importMeta = "";
	#generateCoverageMap = false;
	#coverageMapOutPath = "";

	#env = "browser";
	/** @type {Deno?} */
	#deno = null;

	/** @type {string | URL | import("https://deno.land/x/import_maps@v0.1.1/mod.js").ImportMapData | null} */
	#providedImportMap = null;
	#makeImportMapEntriesReal = true;
	#hasParsedImportMap = false;

	/** @type {import("https://deno.land/x/import_maps@v0.1.1/mod.js").ParsedImportMap} */
	#parsedImportMap = createEmptyImportMap();

	/** @typedef {import("../mod.js").CoverageMapEntry} CoverageMapEntry */
	/** @typedef {import("./CollectedImport.js").CollectedImport} CollectedImport */

	/** @type {Set<(entry: CoverageMapEntry) => void>} */
	#onCoverageMapEntryAddedCbs = new Set();

	/** @type {Map<string, CollectedImport>} */
	#collectedImports = new Map();

	/** @type {Map<string, import("../mod.js").ModuleImplementation>} */
	#fakedModules = new Map();

	/** @type {Map<string, string>} */
	#redirectedModules = new Map();

	/** @type {Map<string, ForcedRealData>} */
	#forcedRealModules = new Map();

	/** @type {Promise<void>?} */
	#makeCoverageDirPromise = null;

	/** @type {Promise<void>[]} */
	#coverageMapWritePromises = [];

	/**
	 * @param {string | URL} importMeta
	 * @param {import("../mod.js").ImporterOptions} options
	 * @param {RuntimeData} runtimeData
	 */
	constructor(
		importMeta,
		{
			generateCoverageMap = "auto",
			coverageMapOutPath = "",
			importMap = undefined,
			makeImportMapEntriesReal = true,
		},
		{
			env = "browser",
			args = [],
			deno = null,
		} = {},
	) {
		this.#env = env;
		this.#deno = deno;

		if (env == "browser" && coverageMapOutPath != "") {
			throw new Error(
				"Writing coverageMap data to files is not supported in browser environments.",
			);
		}
		if (generateCoverageMap === "auto") {
			if (coverageMapOutPath != "") {
				this.#coverageMapOutPath = coverageMapOutPath;
				this.#generateCoverageMap = true;
			} else if (env == "deno") {
				for (const arg of args) {
					if (arg.startsWith(COVERAGE_MAP_ARG)) {
						this.#generateCoverageMap = true;
						this.#coverageMapOutPath = arg.substring(COVERAGE_MAP_ARG.length);
					}
				}
			}
		} else {
			this.#generateCoverageMap = generateCoverageMap;
			this.#coverageMapOutPath = coverageMapOutPath;
		}

		if (generateCoverageMap == false && coverageMapOutPath != "") {
			throw new Error(
				"coverageMapOutPath is only allowed when generateCoverageMap is true.",
			);
		}

		if (importMap != undefined) {
			this.#providedImportMap = importMap;
		}
		this.#makeImportMapEntriesReal = makeImportMapEntriesReal;

		if (importMeta instanceof URL) {
			this.#importMeta = importMeta.href;
		} else {
			this.#importMeta = importMeta;
		}

		if (this.#coverageMapOutPath != "") {
			if (env == "deno" && deno) {
				this.#coverageMapOutPath = resolve(
					fromFileUrl(this.#importMeta),
					this.#coverageMapOutPath,
				);
				this.#makeCoverageDirPromise = deno.mkdir(this.#coverageMapOutPath, {
					recursive: true,
				});
			}
		}
	}

	get generateCoverageMap() {
		return this.#generateCoverageMap;
	}

	get coverageMapOutPath() {
		return this.#coverageMapOutPath;
	}

	/**
	 * @param {string | URL} url
	 * @param {string | import("../mod.js").ModuleImplementation} moduleImplementation
	 */
	registerFakeModule(url, moduleImplementation) {
		if (typeof url === "string") {
			url = new URL(url, this.#importMeta);
		}

		let newModuleImplementation;
		if (typeof moduleImplementation === "string") {
			newModuleImplementation = () => moduleImplementation;
		} else {
			newModuleImplementation = moduleImplementation;
		}

		this.#fakedModules.set(url.href, newModuleImplementation);
	}

	/**
	 * @param {string | URL} url
	 * @param {string | URL} newUrl
	 */
	registerRedirectModule(url, newUrl) {
		if (typeof url === "string") {
			url = new URL(url, this.#importMeta);
		}
		if (typeof newUrl === "string") {
			newUrl = new URL(newUrl, this.#importMeta);
		}

		this.#redirectedModules.set(url.href, newUrl.href);
	}

	/**
	 * @param {string} url
	 * @param {import("../mod.js").MakeRealOptions} options
	 */
	makeReal(url, {
		exactMatch = false,
	} = {}) {
		this.#forcedRealModules.set(url, {
			exactMatch,
		});
	}

	/**
	 * @private
	 */
	async loadImportMap() {
		if (!this.#providedImportMap) return;
		if (this.#hasParsedImportMap) return;

		/** @type {import("https://deno.land/x/import_maps@v0.1.1/mod.js").ImportMapData} */
		let importMapData;
		if (
			typeof this.#providedImportMap === "string" ||
			this.#providedImportMap instanceof URL
		) {
			let resourceUrl;
			if (typeof this.#providedImportMap === "string") {
				resourceUrl = new URL(this.#providedImportMap, this.#importMeta);
			} else {
				resourceUrl = this.#providedImportMap;
			}
			const request = await fetchWithErrorHandling({
				errorMessagePrefix: `Failed install import map from "${resourceUrl}".`,
				fetchArgs: [resourceUrl.href],
			});
			importMapData = await request.json();
		} else {
			importMapData = this.#providedImportMap;
		}
		this.#parsedImportMap = parseImportMap(
			importMapData,
			new URL(this.#importMeta),
		);
		this.#hasParsedImportMap = true;

		if (this.#makeImportMapEntriesReal) {
			for (const entry of Object.keys(this.#parsedImportMap.imports)) {
				this.makeReal(entry, {
					exactMatch: true,
				});
			}
		}
	}

	/**
	 * Before a module is imported, all the imports are first recursively
	 * collected and and placed in the #collectedImports map.
	 * Once every file has loaded and its import urls replaced with blobs,
	 * the entry point is imported with a regular async import call.
	 * @template T
	 * @param {string} url
	 * @returns {Promise<T>}
	 */
	async import(url) {
		await this.loadImportMap();
		const resolvedUrl = await this.getImportUrl(url);
		let module;
		try {
			module = await import(resolvedUrl);
		} catch (e) {
			if (e instanceof Error) {
				e.message = this.replaceBlobUrls(e.message);
				if (e.stack) {
					e.stack = this.replaceBlobUrls(e.stack);
				}
			}
			throw e;
		}
		if (this.#coverageMapWritePromises.length > 0) {
			await Promise.all(this.#coverageMapWritePromises);
		}
		return module;
	}

	/**
	 * Returns the url which should be directly imported from either a dynamic `import()` or
	 * from a `import * from ""` statement inside a module.
	 *
	 * This determines whether the module has been faked, redirected or marked as real.
	 * When faked or redirected, this will return a blob url pointing to the new content.
	 * When marked as real, this will point to the real url without creating any blob url.
	 * @param {string} url The relative url specifier to collect, this is essentially the raw import string from scripts.
	 * @param {Object} options
	 * @param {boolean} [options.allowFakes] If false, the content of the real module will be loaded instead of the fake one.
	 * @param {CollectedImport?} [options.parentImporter] The parent collected import, used for circular import detection.
	 */
	async getImportUrl(url, {
		allowFakes = true,
		parentImporter = null,
	} = {}) {
		const baseUrl = parentImporter ? parentImporter.url : this.#importMeta;
		let resolvedUrl;
		try {
			resolvedUrl = resolveModuleSpecifier(
				this.#parsedImportMap,
				new URL(baseUrl),
				url,
			).href;
		} catch (e) {
			// If something went wrong while resolving, we need to check if the raw specifier was marked as real.
			// If so, the user likely has the specifier in their own import map which was not provided to the Importer.
			// Or there might be another reason why this import could succeed even though we are not able to resolve it.
			if (this.#isExactRealUrl(url)) {
				return url;
			}
			throw e;
		}

		const isExactRealUrl = this.#isExactRealUrl(url);

		let collectedImportKey = "";
		collectedImportKey += isExactRealUrl ? "1" : "0";
		collectedImportKey += allowFakes ? "1" : "0";
		collectedImportKey += resolvedUrl;

		const existing = this.#collectedImports.get(collectedImportKey);
		if (existing) {
			if (parentImporter) {
				existing.addParentCollectedImport(parentImporter);
			}
			if (existing == parentImporter) {
				throw new Error(
					`Circular imports are not supported. "${resolvedUrl}" imports itself.
Consider passing the following path to \`importer.makeReal()\`:
${getRelativePath(this.#importMeta, resolvedUrl)}
`,
				);
			}
			if (parentImporter) {
				const circularImportPath = parentImporter
					.findShortestCircularImportPath(
						existing,
					);
				if (circularImportPath) {
					const rootToParentPath = existing.getShortestPathToRoot();
					rootToParentPath.pop();
					circularImportPath.push(parentImporter);
					circularImportPath.push(existing);
					const importPath = [...rootToParentPath, ...circularImportPath];
					const importFileNames = importPath.map((item) => item.getFileName())
						.join(" -> ");
					const importPaths = importPath.map((item) => getRelativePath(this.#importMeta, item.url));
					const importPathsWithoutDuplicates = Array.from(new Set(importPaths));
					throw new Error(
						`Circular imports are not supported:
${importFileNames}
Consider faking or passing one of the following paths to \`importer.makeReal()\`:
${importPathsWithoutDuplicates.join("\n")}`,
					);
				}
			}
			return await existing.getBlobUrl();
		}

		let collectedImport = null;
		if (allowFakes && this.#fakedModules.has(resolvedUrl)) {
			const moduleImplementation = /** @type {import("../mod.js").ModuleImplementation} */ (this
				.#fakedModules.get(resolvedUrl));
			collectedImport = new CollectedImportFake(
				moduleImplementation,
				resolvedUrl,
				resolvedUrl,
				this,
			);
		}

		if (!collectedImport) {
			let redirectedUrl = resolvedUrl;
			if (allowFakes) {
				redirectedUrl = this.#resolveRedirects(resolvedUrl);
			}
			if (isExactRealUrl) {
				return url;
			}
			const realUrl = this.#getRealUrl(redirectedUrl, baseUrl);
			if (realUrl) return realUrl;
			collectedImport = new CollectedImportFetch(redirectedUrl, resolvedUrl, this);
		}

		if (this.generateCoverageMap) {
			const collectedImport2 = collectedImport;
			collectedImport.onCreatedBlobUrl(() => {
				const entry = collectedImport2.getCoverageMapEntry();
				if (!entry) return;
				this.#onCoverageMapEntryAddedCbs.forEach((cb) => cb(entry));
				const promise = this.writeCoverageEntry(entry);
				this.#coverageMapWritePromises.push(promise);
			});
		}
		if (parentImporter) {
			collectedImport.addParentCollectedImport(parentImporter);
		} else {
			collectedImport.markAsRoot();
		}
		collectedImport.initWithErrorHandling();
		this.#collectedImports.set(collectedImportKey, collectedImport);
		return await collectedImport.getBlobUrl();
	}

	/**
	 * Returns true when the specifier was marked as real with `exactMatch` set to `true`.
	 * @param {string} bareSpecifier
	 */
	#isExactRealUrl(bareSpecifier) {
		const exactMatch = this.#forcedRealModules.get(bareSpecifier);
		if (exactMatch && exactMatch.exactMatch) {
			return true;
		}
		return false;
	}

	/**
	 * Checks if a module has been marked as real, and if so, returns the url
	 * that should be used for importing it instead of creating a collected import.
	 * Returns null if the module is not marked as real.
	 * @param {string} url
	 * @param {string} baseUrl
	 */
	#getRealUrl(url, baseUrl) {
		if (this.#providedImportMap && !this.#hasParsedImportMap) {
			throw new Error("Assertion failed, import map hasn't been parsed yet.");
		}

		const resolvedUrl = resolveModuleSpecifier(
			this.#parsedImportMap,
			new URL(baseUrl),
			url,
		).href;

		for (const [forcedModule, forcedRealData] of this.#forcedRealModules) {
			if (forcedRealData.exactMatch) continue;
			let newForcedModule;
			try {
				newForcedModule = resolveModuleSpecifier(
					this.#parsedImportMap,
					new URL(this.#importMeta),
					forcedModule,
				);
			} catch {
				// Resolving a specifier can fail for all sorts of reasons.
				// However, we're iterating over all forced real modules, which
				// might contain invalid values. We don't want this function to fail
				// just because the forced real modules contains an invalid value.
				// We'll just continue, since maybe the next forced module is a valid one.
				continue;
			}
			if (resolvedUrl == newForcedModule.href) {
				return resolvedUrl;
			}
		}

		return null;
	}

	/**
	 * @param {string} url The absolute (import map resolved) url of the file.
	 */
	#resolveRedirects(url) {
		const seenRedirects = new Set();
		while (true) {
			if (seenRedirects.has(url)) {
				const redirects = Array.from(seenRedirects);
				redirects.push(redirects[0]);
				const redirectsStr = redirects.map((r) => `"${r}"`).join(" -> ");
				throw new Error(`Circular redirects detected.\n${redirectsStr}`);
			}
			seenRedirects.add(url);
			const result = this.#redirectedModules.get(url);
			if (result) {
				url = result;
			} else {
				break;
			}
		}
		return url;
	}

	/**
	 * Replaces all occurrences of known blob urls in the given string with the
	 * correct file path. Useful for fixing up error messages.
	 * @param {string} str
	 */
	replaceBlobUrls(str) {
		for (const collectedImport of this.#collectedImports.values()) {
			if (!collectedImport.createdBlobUrl) continue;
			str = str.replaceAll(collectedImport.createdBlobUrl, collectedImport.url);
		}
		return str;
	}

	getCoverageMap() {
		if (!this.generateCoverageMap) {
			throw new Error(
				"Coverage map generation is not enabled. Make sure to create your Importer with generateCoverageMap set to true.",
			);
		}
		/** @type {Object.<string, CoverageMapEntry>} */
		const map = {};
		for (const collectedImport of this.#collectedImports.values()) {
			const entry = collectedImport.getCoverageMapEntry();
			if (entry) {
				map[entry.replacedUrl] = entry;
			}
		}
		return map;
	}

	/**
	 * @param {(entry: CoverageMapEntry) => void} cb
	 */
	onCoverageMapEntryAdded(cb) {
		this.#onCoverageMapEntryAddedCbs.add(cb);
	}

	/**
	 * @param {(entry: CoverageMapEntry) => void} cb
	 */
	removeOnCoverageMapEntryAdded(cb) {
		this.#onCoverageMapEntryAddedCbs.delete(cb);
	}

	/**
	 * @param {CoverageMapEntry} entry
	 */
	async writeCoverageEntry(entry) {
		if (this.#env == "deno" && this.#deno && this.#coverageMapOutPath != "") {
			if (!this.#makeCoverageDirPromise) return;
			await this.#makeCoverageDirPromise;

			const str = JSON.stringify(entry, null, 2);
			const uuid = crypto.randomUUID();
			const fileName = `${uuid}.json`;
			const writePath = resolve(this.#coverageMapOutPath, fileName);
			await this.#deno.writeTextFile(writePath, str);
		}
	}
}
