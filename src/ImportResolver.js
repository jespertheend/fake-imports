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

/** @typedef {"browser" | "deno"} Environment */

/**
 * @typedef RuntimeData
 * @property {Environment} [env]
 * @property {string[]} [args]
 * @property {Deno?} [deno]
 */

const COVERAGE_MAP_ARG = "--fi-coverage-map=";
const FORCE_COVERAGE_ARG_WRITE_TIMEOUT_ARG =
  "--fi-force-coverage-map-write-timeout=";

export class ImportResolver {
  #importMeta = "";
  #generateCoverageMap = false;
  #coverageMapOutPath = "";
  #forceCoverageMapWriteTimeout = 0;

  #env = "browser";
  /** @type {Deno?} */
  #deno = null;

  /** @typedef {import("../mod.js").CoverageMapEntry} CoverageMapEntry */
  /** @typedef {import("./CollectedImport.js").CollectedImport} CollectedImport */

  /** @type {Set<(entry: CoverageMapEntry) => void>} */
  #onCoverageMapEntryAddedCbs = new Set();

  /** @type {Map<string, CollectedImport>} */
  #collectedImports = new Map();

  /** @type {Map<string, import("../mod.js").ModuleImplementation>} */
  #fakedModules = new Map();

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
      forceCoverageMapWriteTimeout = 0,
    },
    {
      env = "browser",
      args = [],
      deno = null,
    } = {},
  ) {
    this.#env = env;
    this.#deno = deno;
    this.#forceCoverageMapWriteTimeout = forceCoverageMapWriteTimeout;

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

    for (const arg of args) {
      if (arg.startsWith(FORCE_COVERAGE_ARG_WRITE_TIMEOUT_ARG)) {
        const strValue = arg.substring(
          FORCE_COVERAGE_ARG_WRITE_TIMEOUT_ARG.length,
        );
        const numValue = parseInt(strValue);
        if (isNaN(numValue)) {
          throw new Error(
            `Invalid value for ${FORCE_COVERAGE_ARG_WRITE_TIMEOUT_ARG}`,
          );
        } else {
          this.#forceCoverageMapWriteTimeout = numValue;
        }
        this.#assertCoverageMapWriteTimeoutArg(
          `${FORCE_COVERAGE_ARG_WRITE_TIMEOUT_ARG} requires ${COVERAGE_MAP_ARG}`,
        );
      }
    }

    this.#assertCoverageMapWriteTimeoutArg(
      `forceCoverageMapWriteTimeout requires generateCoverageMap to be true or "auto" with ${COVERAGE_MAP_ARG}`,
    );
  }

  /**
   * @param {string} message
   */
  #assertCoverageMapWriteTimeoutArg(message) {
    if (this.forceCoverageMapWriteTimeout > 0 && !this.coverageMapOutPath) {
      throw new Error(message);
    }
  }

  get generateCoverageMap() {
    return this.#generateCoverageMap;
  }

  get coverageMapOutPath() {
    return this.#coverageMapOutPath;
  }

  get forceCoverageMapWriteTimeout() {
    return this.#forceCoverageMapWriteTimeout;
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
   * Before a module is imported, all the imports are first recursively
   * collected and and placed in the #collectedImports map.
   * Once every file has loaded and its import urls replaced with blobs,
   * the entry point is imported with a regular async import call.
   * @template T
   * @param {string | URL} url
   * @returns {Promise<T>}
   */
  async import(url) {
    if (typeof url === "string") {
      url = new URL(url, this.#importMeta);
    }
    const collectedImport = this.createCollectedImport(url.href);
    return await import(await collectedImport.getBlobUrl());
  }

  /**
   * Creates a new CollectedImport instance and adds it to the collectedImports map.
   * The created collected import will call this function as well, this way
   * all modules are recursively collected.
   * @param {string} url The full (non relative) url to fetch.
   * @param {Object} [options]
   * @param {boolean} [options.allowFakes] If true, the real module will be loaded instead of the fake one.
   * @param {CollectedImport?} [options.parentImporter] The parent collected import, used for circular import detection.
   */
  createCollectedImport(url, {
    allowFakes = true,
    parentImporter = null,
  } = {}) {
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

    let collectedImport;
    if (this.#fakedModules.has(url) && allowFakes) {
      const moduleImplementation =
        /** @type {import("../mod.js").ModuleImplementation} */ (this
          .#fakedModules.get(url));
      collectedImport = new CollectedImportFake(
        moduleImplementation,
        url,
        this,
      );
    } else {
      collectedImport = new CollectedImportFetch(url, this);
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

      if (this.forceCoverageMapWriteTimeout > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, this.forceCoverageMapWriteTimeout);
        });
      }

      const str = JSON.stringify(entry, null, 2);
      const uuid = crypto.randomUUID();
      const fileName = `${uuid}.json`;
      const writePath = resolve(this.#coverageMapOutPath, fileName);
      await this.#deno.writeTextFile(writePath, str);
    }
  }

  async finishCoverageMapWrites() {
    await Promise.all(this.#coverageMapWritePromises);
  }
}
