import { computeDiffOffsets } from "./computeDiffOffsets.js";
import { parseImports } from "./parseImports.js";
import { replaceImports } from "./replaceImports.js";

/**
 * @typedef {Object} ResolveImportData
 * @property {string} url
 * @property {boolean} [allowFakes = true]
 */

/**
 * @typedef BlobUrlReadySuccessData
 * @property {true} success
 * @property {string} blobUrl
 */

/**
 * @typedef BlobUrlReadyErrorData
 * @property {false} success
 * @property {unknown} error
 */

/** @typedef {BlobUrlReadySuccessData | BlobUrlReadyErrorData} BlobUrlReadyData */

/** @typedef {(data: BlobUrlReadyData) => void} BlobUrlReadyCallback */

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
  /** @type {Set<BlobUrlReadyCallback>} */
  #onBlobUrlReadyCbs = new Set();
  /** @type {BlobUrlReadyData?} */
  #onBlobUrlReadyResult = null;

  /** @type {import("./computeDiffOffsets.js").DiffOffsets?} */
  #diffOffsets = null;

  /** @type {Set<CollectedImport>} */
  #parentCollectedImports = new Set();

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

  async initWithErrorHandling() {
    try {
      await this.init();
    } catch (e) {
      this.triggerCreatedBlobUrlCallbacks({ success: false, error: e });
    }
  }

  /**
   * @private
   */
  async init() {
    let originalContent = await this.handleGetOriginalContent();
    const scriptContent = await this.handleGetContent();
    if (originalContent === null) {
      originalContent = scriptContent;
    }

    const imports = parseImports(scriptContent);
    const blobUrlPromises = [];
    for (const importData of imports) {
      const promise = (async () => {
        const resolvedUrl = new URL(importData.url, this.url);
        const resolveData = this.handleResolveImport(resolvedUrl.href);
        const collectedImport = this.#resolver.createCollectedImport(
          resolveData.url,
          {
            allowFakes: resolveData.allowFakes,
            parentImporter: this,
          },
        );
        return await collectedImport.getBlobUrl();
      })();
      blobUrlPromises.push(promise);
    }

    let blobUrls;
    try {
      blobUrls = await Promise.all(blobUrlPromises);
    } catch (e) {
      this.triggerCreatedBlobUrlCallbacks({ success: false, error: e });
      return;
    }

    const newScriptContent = replaceImports(imports, blobUrls, scriptContent);

    if (this.#resolver.generateCoverageMap) {
      this.#diffOffsets = computeDiffOffsets(newScriptContent, originalContent);
    }

    const blobUrl = URL.createObjectURL(
      new Blob([newScriptContent], { type: "text/javascript" }),
    );
    this.#createdBlobUrl = blobUrl;
    this.triggerCreatedBlobUrlCallbacks({ success: true, blobUrl });
  }

  /**
   * @param {CollectedImport} collectedImport
   */
  addParentCollectedImport(collectedImport) {
    this.#parentCollectedImports.add(collectedImport);
  }

  /**
   * If this collected import has `parentCollectedImport` as parent, an array
   * is returned that represents the chain of imports. If the import is not
   * currently found in any of the parents, null is returned.
   *
   * @param {CollectedImport} parentCollectedImport
   * @returns {CollectedImport[]?}
   */
  findClosestCircularImportPath(parentCollectedImport) {
    for (const parent of this.#parentCollectedImports) {
      if (parent == parentCollectedImport) return [parent];

      const pathFromParent = parent.findClosestCircularImportPath(
        parentCollectedImport,
      );
      if (pathFromParent) {
        return [...pathFromParent, parent];
      }
    }
    return null;
  }

  getFileName() {
    const url = new URL(this.url);
    const splitPath = url.pathname.split("/");
    if (splitPath.length > 0) {
      const lastItem = splitPath[splitPath.length - 1];
      if (lastItem.length > 0) {
        return lastItem;
      }
    }
    return this.url;
  }

  /**
   * @returns {Promise<string>}
   */
  async getBlobUrl() {
    if (this.#onBlobUrlReadyResult) {
      if (this.#onBlobUrlReadyResult.success) {
        return this.#onBlobUrlReadyResult.blobUrl;
      } else {
        throw this.#onBlobUrlReadyResult.error;
      }
    }
    return await new Promise((resolve, reject) => {
      this.onCreatedBlobUrl((data) => {
        if (data.success) {
          resolve(data.blobUrl);
        } else {
          reject(data.error);
        }
      });
    });
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
   * @param {BlobUrlReadyCallback} cb
   */
  onCreatedBlobUrl(cb) {
    this.#onBlobUrlReadyCbs.add(cb);
  }

  /**
   * @private
   * @param {BlobUrlReadyData} data
   */
  triggerCreatedBlobUrlCallbacks(data) {
    if (this.#onBlobUrlReadyResult) return;
    this.#onBlobUrlReadyResult = data;
    this.#onBlobUrlReadyCbs.forEach((cb) => cb(data));
    this.#onBlobUrlReadyCbs.clear();
  }
}
