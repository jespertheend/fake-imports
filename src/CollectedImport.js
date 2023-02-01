import { computeDiffOffsets } from "./computeDiffOffsets.js";
import { parseImports } from "./parseImports.js";
import { replaceImports } from "./replaceImports.js";

/**
 * @typedef {Object} ResolveImportData
 * @property {string} url The relative url to replace the import with.
 * @property {boolean} [allowFakes = true]
 */

/**
 * @typedef {Object} ScriptContent
 * @property {string} script
 * @property {string?} mimeType
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

	#isUsedAsRootImport = false;
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
	 * @returns {Promise<ScriptContent>}
	 */
	async handleGetContent() {
		return await new Promise((r) =>
			r({
				script: "",
				mimeType: null,
			})
		);
	}

	/**
	 * @param {string} url The relative url to resolve, this is essentially the raw string from the import statement.
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
			originalContent = scriptContent.script;
		}

		const imports = parseImports(scriptContent.script);
		const blobUrlPromises = [];
		for (const importData of imports) {
			const promise = (async () => {
				const realUrl = this.#resolver.getRealUrl(importData.url, this.url);
				if (realUrl != null) {
					return realUrl;
				}
				const resolveData = this.handleResolveImport(importData.url);
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

		const newScriptContent = replaceImports(
			imports,
			blobUrls,
			scriptContent.script,
		);

		if (this.#resolver.generateCoverageMap) {
			this.#diffOffsets = computeDiffOffsets(newScriptContent, originalContent);
		}

		let mimeType = scriptContent.mimeType;
		if (mimeType === null) {
			if (this.url.endsWith(".ts")) {
				mimeType = "text/typescript";
			} else {
				mimeType = "text/javascript";
			}
		}

		const blobUrl = URL.createObjectURL(
			new Blob([newScriptContent], { type: mimeType }),
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
	 * Marks this import as being imported as root at least once.
	 * This is used to determine if traversing up using `getAllPathsToRoot()`
	 * should stop at this import.
	 */
	markAsRoot() {
		this.#isUsedAsRootImport = true;
	}

	/**
	 * If this module was imported by one or multiple another modules, this method
	 * will return the first module that imported this module.
	 * If the module was imported by the user directly, null is returned.
	 */
	getFirstParentCollectedImport() {
		for (const parent of this.#parentCollectedImports) {
			return parent;
		}
		return null;
	}

	/**
	 * If this collected import has `parentCollectedImport` as parent, an array
	 * is returned that represents the chain of imports. If the import is not
	 * currently found in any of the parents, null is returned.
	 *
	 * @param {CollectedImport} parentCollectedImport
	 * @returns {CollectedImport[]?}
	 */
	findShortestCircularImportPath(parentCollectedImport) {
		for (const parent of this.#parentCollectedImports) {
			if (parent == parentCollectedImport) return [parent];

			const pathFromParent = parent.findShortestCircularImportPath(
				parentCollectedImport,
			);
			if (pathFromParent) {
				return [...pathFromParent, parent];
			}
		}
		return null;
	}

	/**
	 * Recursively travels up the import chain and returns all the paths leading
	 * to a root.
	 * @param {Set<CollectedImport>} seenBeforeParents
	 * @returns {CollectedImport[][]}
	 */
	getAllPathsToRoot(seenBeforeParents = new Set()) {
		if (seenBeforeParents.has(this)) {
			return [];
		}
		seenBeforeParents.add(this);
		/** @type {CollectedImport[][]} */
		const paths = [];
		if (this.#isUsedAsRootImport) {
			paths.push([this]);
		}
		for (const parent of this.#parentCollectedImports) {
			for (const path of parent.getAllPathsToRoot(seenBeforeParents)) {
				paths.push([...path, this]);
			}
		}
		return paths;
	}

	/**
	 * Recursively travels up the chain of parents and returns the shortest
	 * chain of imports that leads to this module.
	 * Returns an array with as first item a root module and as last item this
	 * module.
	 *
	 * @returns {CollectedImport[]}
	 */
	getShortestPathToRoot() {
		let shortestLength = Infinity;
		let shortestPath = null;
		for (const path of this.getAllPathsToRoot()) {
			if (path.length < shortestLength) {
				shortestLength = path.length;
				shortestPath = path;
			}
		}
		if (!shortestPath) {
			throw new Error("Assertion failed, no paths to root found.");
		}
		return shortestPath;
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
	 * The blob url that was created for this module, returns null if the blob
	 * url was not created yet.
	 */
	get createdBlobUrl() {
		return this.#createdBlobUrl;
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
