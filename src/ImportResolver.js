import {CollectedImport} from "./CollectedImport.js";

export class ImportResolver {

	#importMeta = "";

	/** @type {Map<string, CollectedImport>} */
	#collectedImports = new Map();

	/**
	 * @param {string | URL} importMeta
	 */
	constructor(importMeta) {
		if (importMeta instanceof URL) {
			this.#importMeta = importMeta.href;
		} else {
			this.#importMeta = importMeta;
		}

		/**
		 * @template T
		 * @type {((importUrl: string | URL) => Promise<any>) | null})}
		 */
		this.createdImportFunction = null;
	}

	/**
	 * @returns {<T>(importUrl: string | URL) => Promise<T>}
	 */
	getImportFunction() {
		if (this.createdImportFunction) return this.createdImportFunction;

		this.createdImportFunction = async importUrl => {
			if (typeof importUrl === "string") {
				importUrl = new URL(importUrl, this.#importMeta);
			}
			const collectedImport = this.#collectImport(importUrl.href);
			return await import(await collectedImport.getBlobUrl());
		}
		return this.createdImportFunction;
	}

	/**
	 * @param {string} url The full (non relative) url to fetch.
	 */
	#collectImport(url) {
		const collectedImport = new CollectedImport(url, this);
		this.#collectedImports.set(url, collectedImport);
		return collectedImport;
	}
}
