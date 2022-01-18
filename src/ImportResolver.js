import { CollectedImportFake } from "./CollectedImportFake.js";
import { CollectedImportFetch } from "./CollectedImportFetch.js";

/** @typedef {"browser" | "deno"} Environment */

/**
 * @typedef RuntimeData
 * @property {Environment} [env]
 * @property {string[]} [args]
 */

export class ImportResolver {
  #importMeta = "";
  #generateCoverageMap = false;
  #coverageMapOutPath = "";

  /** @type {Set<(entry: import("../mod.js").CoverageMapEntry) => void>} */
  #onCoverageMapEntryAddedCbs = new Set();

  /** @type {Map<string, import("./CollectedImport.js").CollectedImport>} */
  #collectedImports = new Map();

  /** @type {Map<string, import("../mod.js").ModuleImplementation>} */
  #fakedModules = new Map();

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
    },
    {
      env = "browser",
      args = [],
    } = {},
  ) {
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
          const coverageArg = "--coverage=";
          if (arg.startsWith(coverageArg)) {
            this.#generateCoverageMap = true;
            this.#coverageMapOutPath = arg.substring(coverageArg.length);
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
   * @param {string} url The full (non relative) url to fetch.
   * @param {boolean} allowFakes If true, the real module will be loaded instead of the fake one.
   */
  createCollectedImport(url, allowFakes = true) {
    let collectedImportKey = "";
    collectedImportKey += allowFakes ? "1" : "0";
    collectedImportKey += url;

    const existing = this.#collectedImports.get(collectedImportKey);
    if (existing) return existing;

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
    const collectedImport2 = collectedImport;
    collectedImport.onCreatedBlobUrl(() => {
      const entry = collectedImport2.getCoverageMapEntry();
      if (!entry) return;
      this.#onCoverageMapEntryAddedCbs.forEach((cb) => cb(entry));
    });
    collectedImport.init();
    this.#collectedImports.set(collectedImportKey, collectedImport);
    return collectedImport;
  }

  getCoverageMap() {
    /** @type {Object.<string, import("../mod.js").CoverageMapEntry>} */
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
   * @param {(entry: import("../mod.js").CoverageMapEntry) => void} cb
   */
  onCoverageMapEntryAdded(cb) {
    this.#onCoverageMapEntryAddedCbs.add(cb);
  }

  /**
   * @param {(entry: import("../mod.js").CoverageMapEntry) => void} cb
   */
  removeOnCoverageMapEntryAdded(cb) {
    this.#onCoverageMapEntryAddedCbs.delete(cb);
  }
}
