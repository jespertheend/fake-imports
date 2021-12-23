import {parseImports} from "./parseImports.js";
import { replaceImports } from "./replaceImports.js";

export class CollectedImport {

	#url;
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
		this.#url = url;
		this.#resolver = resolver;

		this.#fetchContent();
	}

	async #fetchContent() {
		const response = await fetch(this.#url);
		const scriptContent = await response.text();

		const imports = parseImports(scriptContent);
		const collectedImports = [];
		const blobUrlPromises = [];
		for (const importData of imports) {
			const resolvedUrl = new URL(importData.url, this.#url);
			const collectedImport = this.#resolver.createCollectedImport(resolvedUrl.href);
			collectedImports.push(collectedImport);
			blobUrlPromises.push(collectedImport.getBlobUrl());
		}

		const blobUrls = await Promise.all(blobUrlPromises);

		const newScriptContent = replaceImports(imports, blobUrls, scriptContent);

		const blobUrl = URL.createObjectURL(new Blob([newScriptContent], {type: "text/javascript"}));
		this.#createdBlobUrl = blobUrl;
		this.#onBlobUrlReadyCbs.forEach(cb => cb(blobUrl));
		this.#onBlobUrlReadyCbs.clear();
	}

	/**
	 * @returns {Promise<string>}
	 */
	async getBlobUrl() {
		if (this.#createdBlobUrl) return this.#createdBlobUrl;
		return await new Promise(r => this.#onBlobUrlReadyCbs.add(r));
	}
}
