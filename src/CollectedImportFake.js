import { CollectedImport } from "./CollectedImport.js";

export class CollectedImportFake extends CollectedImport {
	/** @type {Promise<string>?} */
	#originalContentPromise = null;
	/**
	 * @param {import("../mod.js").ModuleImplementation} fakeModuleImplementation
	 * @param {ConstructorParameters<typeof CollectedImport>} args
	 */
	constructor(fakeModuleImplementation, ...args) {
		super(...args);
		this.fakeModuleImplementation = fakeModuleImplementation;
	}

	getOriginalContentPromise() {
		if (this.#originalContentPromise) return this.#originalContentPromise;

		this.#originalContentPromise = (async () => {
			try {
				const response = await fetch(this.url);
				return await response.text();
			} catch {
				return "";
			}
		})();
		return this.#originalContentPromise;
	}

	/**
	 * @override
	 */
	async handleGetOriginalContent() {
		return await this.getOriginalContentPromise();
	}

	/**
	 * @override
	 */
	async handleGetContent() {
		if (this.fakeModuleImplementation.length <= 0) {
			const castFn = /** @type {() => string} */ (this.fakeModuleImplementation);
			return {
				script: castFn(),
				mimeType: null,
			};
		} else {
			const fullContent = await this.getOriginalContentPromise();
			/** @type {import("../mod.js").OriginalModuleData} */
			const originalData = {
				url: this.url,
				fullContent,
			};
			const script = this.fakeModuleImplementation(originalData);
			return {
				script,
				mimeType: null,
			};
		}
	}

	/**
	 * @override
	 * @param {string} url The relative url to resolve.
	 * @returns {import("./CollectedImport.js").ResolveImportData}
	 */
	handleResolveImport(url) {
		const resolvedUrl = new URL(url, this.url);
		const allowFakes = resolvedUrl.href !== this.url;
		return { url, allowFakes };
	}
}
