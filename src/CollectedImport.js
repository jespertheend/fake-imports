import { computeDiffOffsets } from "./computeDiffOffsets.js";
import { parseImports } from "./parseImports.js";
import { replaceImports } from "./replaceImports.js";

/**
 * @typedef {Object} ResolveImportData
 * @property {string} url
 * @property {boolean} [allowFakes = true]
 */

/**
 * A single imported module. This class is responsible for loading the contents
 * of the module and generating a blob url for it. This class only provides
 * logic for getting module content is handled in CollectedImportFake and
 * CollectedImportFetch.
 */
export class CollectedImport {
  #resolver;

  /** @type {string?} */
  #createdBlobUrl = null;
  /** @type {Set<(blobUrl: string) => any>} */
  #onBlobUrlReadyCbs = new Set();

  /** @type {import("./computeDiffOffsets.js").DiffOffsets?} */
  #diffOffsets = null;

  /**
   * @param {string} url The full (non relative) url to fetch.
   * @param {import("./ImportResolver.js").ImportResolver} resolver
   */
  constructor(url, resolver) {
    this.url = url;
    this.#resolver = resolver;
  }

  /**
   * Should return the original content before any modifications were made.
   * Return null if the content will not be changed. In this case the value
   * of `handleGetContent` will be used as original.
   * @abstract
   * @returns {Promise<string?>}
   */
  async handleGetOriginalContent() {
    return await new Promise((r) => r(null));
  }

  /**
   * @abstract
   * @returns {Promise<string>}
   */
  async handleGetContent() {
    return await new Promise((r) => r(""));
  }

  /**
   * @param {string} url The full (non-relative) url to resolve.
   * @returns {ResolveImportData}
   */
  handleResolveImport(url) {
    return { url };
  }

  async init() {
    let originalContent = await this.handleGetOriginalContent();
    const scriptContent = await this.handleGetContent();
    if (originalContent === null) {
      originalContent = scriptContent;
    }

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

    if (this.#resolver.generateCoverageMap) {
      this.#diffOffsets = computeDiffOffsets(newScriptContent, originalContent);
    }

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
    if (!this.#resolver.generateCoverageMap) {
      throw new Error(
        "Coverage map generation is not enabled. Make sure to create your Importer with generateCoverageMap set to true.",
      );
    }
    if (!this.#createdBlobUrl || !this.#diffOffsets) return null;
    /** @type {import("../mod.js").CoverageMapEntry} */
    const entry = {
      replacedUrl: this.#createdBlobUrl,
      originalUrl: this.url,
      diffOffsets: this.#diffOffsets,
    };
    return entry;
  }

  /**
   * @param {(blobUrl: string) => void} cb
   */
  onCreatedBlobUrl(cb) {
    this.#onBlobUrlReadyCbs.add(cb);
  }
}
