export class ImportResolver {
	#importMeta = "";

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
			return await import(importUrl.href);
		}
		return this.createdImportFunction;
	}
}
