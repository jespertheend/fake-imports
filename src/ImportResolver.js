import { CollectedImportFake } from "./CollectedImportFake.js";
import { CollectedImportFetch } from "./CollectedImportFetch.js";

export class ImportResolver {
  #importMeta = "";

  /** @type {Map<string, import("./CollectedImport.js").CollectedImport>} */
  #collectedImports = new Map();

  /** @type {Map<string, string>} */
  #fakedModules = new Map();

  /**
   * @param {string | URL} importMeta
   */
  constructor(importMeta) {
    if (importMeta instanceof URL) {
      this.#importMeta = importMeta.href;
    } else {
      this.#importMeta = importMeta;
    }
  }

  /**
   * @param {string | URL} url
   * @param {string} moduleImplementation
   */
  registerFakeModule(url, moduleImplementation) {
    if (typeof url === "string") {
      url = new URL(url, this.#importMeta);
    }

    this.#fakedModules.set(url.href, moduleImplementation);
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

    if (this.#collectedImports.has(collectedImportKey)) {
      return this.#collectedImports.get(collectedImportKey);
    }

    let collectedImport;
    if (this.#fakedModules.has(url) && allowFakes) {
      const fake = /** @type {string} */ (this.#fakedModules.get(url));
      collectedImport = new CollectedImportFake(fake, url, this);
    } else {
      collectedImport = new CollectedImportFetch(url, this);
    }
    this.#collectedImports.set(collectedImportKey, collectedImport);
    return collectedImport;
  }
}
