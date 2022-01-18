import { parseImports } from "./parseImports.js";
import { replaceImports } from "./replaceImports.js";

/**
 * @typedef {Object} ResolveImportData
 * @property {string} url
 * @property {boolean} [allowFakes = true]
 */

export class CollectedImport {
  #resolver;

  /** @type {string?} */
  #createdBlobUrl = null;
  /** @type {Set<(blobUrl: string) => any>} */
  #onBlobUrlReadyCbs = new Set();

  /**
   * @param {string} url The full (non relative) url to fetch.
   * @param {import("./ImportResolver.js").ImportResolver} resolver
   */
  constructor(url, resolver) {
    this.url = url;
    this.#resolver = resolver;
  }

  /**
   * @returns {Promise<string>}
   */
  async handleGetContent() {
    return await "";
  }

  /**
   * @param {string} url The full (non-relative) url to resolve.
   * @returns {ResolveImportData}
   */
  handleResolveImport(url) {
    return { url };
  }

  async init() {
    const scriptContent = await this.handleGetContent();

    const imports = parseImports(scriptContent);
    const blobUrlPromises = [];
    for (const importData of imports) {
      const resolvedUrl = new URL(importData.url, this.url);
      const resolveData = this.handleResolveImport(resolvedUrl.href);
      const collectedImport = this.#resolver.createCollectedImport(
        resolveData.url,
        resolveData.allowFakes ?? true,
      );
      blobUrlPromises.push(collectedImport.getBlobUrl());
    }

    const blobUrls = await Promise.all(blobUrlPromises);

    const newScriptContent = replaceImports(imports, blobUrls, scriptContent);

    const blobUrl = URL.createObjectURL(
      new Blob([newScriptContent], { type: "text/javascript" }),
    );
    this.#createdBlobUrl = blobUrl;
    this.#onBlobUrlReadyCbs.forEach((cb) => cb(blobUrl));
    this.#onBlobUrlReadyCbs.clear();
  }

  /**
   * @returns {Promise<string>}
   */
  async getBlobUrl() {
    if (this.#createdBlobUrl) return this.#createdBlobUrl;
    return await new Promise((r) => this.#onBlobUrlReadyCbs.add(r));
  }

  getCoverageMapEntry() {
    if (!this.#createdBlobUrl) return null;
    return {
      blobUrl: this.#createdBlobUrl,
      url: this.url,
    };
  }
}
