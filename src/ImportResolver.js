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

import {
  fromFileUrl,
  resolve,
} from "https://deno.land/std@0.121.0/path/mod.ts";
import { CollectedImportFake } from "./CollectedImportFake.js";
import { CollectedImportFetch } from "./CollectedImportFetch.js";
import { parseImportMap, resolveModuleSpecifier } from "./importMapParser.js";
import { fetchWithErrorHandling } from "./shared.js";

/** @typedef {"browser" | "deno"} Environment */

/**
 * @typedef RuntimeData
 * @property {Environment} [env]
 * @property {string[]} [args]
 * @property {Deno?} [deno]
 */

/**
 * @typedef ForcedRealData
 * @property {boolean} useUnresolved
 */

const COVERAGE_MAP_ARG = "--fi-coverage-map=";

export class ImportResolver {
  #importMeta = "";
  #generateCoverageMap = false;
  #coverageMapOutPath = "";

  #env = "browser";
  /** @type {Deno?} */
  #deno = null;

  /** @type {string | URL | import("./importMapParser.js").ImportMapData | null} */
  #providedImportMap = null;

  #hasParsedImportMap = false;

  /** @type {import("./importMapParser.js").ParsedImportMap} */
  #parsedImportMap = {
    imports: {},
  };

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
   * @param {RuntimeData} [runtimeData]
   */
  constructor(
    importMeta,
    {
      generateCoverageMap = "auto",
      coverageMapOutPath = "",
      importMap = undefined,
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
   * @param {import("../mod.js").MakeRealOptions} [options]
   */
  makeReal(url, {
    useUnresolved = false,
  } = {}) {
    this.#forcedRealModules.set(url, {
      useUnresolved,
    });
  }

  /**
   * @private
   */
  async loadImportMap() {
    if (!this.#providedImportMap) return;
    if (this.#hasParsedImportMap) return;

    /** @type {import("./importMapParser.js").ImportMapData} */
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
    const newUrl = resolveModuleSpecifier(
      this.#parsedImportMap,
      new URL(this.#importMeta),
      url,
    );
    await this.loadImportMap();
    const collectedImport = this.createCollectedImport(newUrl.href);
    let module;
    try {
      module = await import(await collectedImport.getBlobUrl());
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
   * @param {string} url
   * @param {string} baseUrl
   */
  getRealUrl(url, baseUrl) {
    if (this.#providedImportMap && !this.#hasParsedImportMap) {
      throw new Error("Assertion failed, import map hasn't been parsed yet.");
    }

    const exactMatch = this.#forcedRealModules.get(url);
    if (exactMatch && exactMatch.useUnresolved) {
      return url;
    }

    const newUrl = resolveModuleSpecifier(
      this.#parsedImportMap,
      new URL(baseUrl),
      url,
    );
    const newUrlSerialized = newUrl.href;

    for (const forcedModule of this.#forcedRealModules.keys()) {
      const newForcedModule = resolveModuleSpecifier(
        this.#parsedImportMap,
        new URL(this.#importMeta),
        forcedModule,
      );
      if (newUrlSerialized == newForcedModule.href) {
        return newUrlSerialized;
      }
    }

    return null;
  }

  /**
   * Creates a new CollectedImport instance and adds it to the collectedImports map.
   * The created collected import will call this function as well, this way
   * all modules are recursively collected.
   * @param {string} url The relative url specifier to collect, this is essentially the raw import string from scripts.
   * @param {Object} [options]
   * @param {boolean} [options.allowFakes] If true, the real module will be loaded instead of the fake one.
   * @param {CollectedImport?} [options.parentImporter] The parent collected import, used for circular import detection.
   */
  createCollectedImport(url, {
    allowFakes = true,
    parentImporter = null,
  } = {}) {
    const baseUrl = parentImporter ? parentImporter.url : this.#importMeta;
    const newUrl = resolveModuleSpecifier(
      this.#parsedImportMap,
      new URL(baseUrl),
      url,
    );
    url = newUrl.href;

    let collectedImportKey = "";
    collectedImportKey += allowFakes ? "1" : "0";
    collectedImportKey += url;

    const existing = this.#collectedImports.get(collectedImportKey);
    if (existing) {
      if (parentImporter) {
        existing.addParentCollectedImport(parentImporter);
      }
      if (existing == parentImporter) {
        throw new Error(
          `Circular imports are not supported. "${url}" imports itself.`,
        );
      }
      if (parentImporter) {
        const circularImportPath = parentImporter.findClosestCircularImportPath(
          existing,
        );
        if (circularImportPath) {
          circularImportPath.push(parentImporter);
          circularImportPath.push(existing);
          const importPath = circularImportPath.map((item) =>
            item.getFileName()
          ).join(" -> ");
          throw new Error(
            `Circular imports are not supported:\n${importPath}`,
          );
        }
      }
      return existing;
    }

    const seenRedirects = new Set();
    let redirectedUrl = url;
    while (true) {
      if (seenRedirects.has(redirectedUrl)) {
        const redirects = Array.from(seenRedirects);
        redirects.push(redirects[0]);
        const redirectsStr = redirects.map((r) => `"${r}"`).join(" -> ");
        throw new Error(`Circular redirects detected.\n${redirectsStr}`);
      }
      seenRedirects.add(redirectedUrl);
      const result = this.#redirectedModules.get(redirectedUrl);
      if (result) {
        redirectedUrl = result;
      } else {
        break;
      }
    }

    let collectedImport;
    if (this.#fakedModules.has(redirectedUrl) && allowFakes) {
      const moduleImplementation =
        /** @type {import("../mod.js").ModuleImplementation} */ (this
          .#fakedModules.get(redirectedUrl));
      collectedImport = new CollectedImportFake(
        moduleImplementation,
        redirectedUrl,
        this,
      );
    } else {
      collectedImport = new CollectedImportFetch(redirectedUrl, this);
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
    }
    collectedImport.initWithErrorHandling();
    this.#collectedImports.set(collectedImportKey, collectedImport);
    return collectedImport;
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
