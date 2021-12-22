export class CollectedImport {

	#url = "";

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

		this.#fetchContent();
	}

	async #fetchContent() {
		const response = await fetch(this.#url);
		const scriptContent = await response.text();

		const blobUrl = URL.createObjectURL(new Blob([scriptContent], {type: "text/javascript"}));
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
