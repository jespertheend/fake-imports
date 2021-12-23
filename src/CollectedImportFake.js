import { CollectedImport } from "./CollectedImport.js";

export class CollectedImportFake extends CollectedImport {
  /**
   * @param {string} fakeScriptSource
   * @param {ConstructorParameters<typeof CollectedImport>} args
   */
  constructor(fakeScriptSource, ...args) {
    super(...args);
    this.fakeScriptSource = fakeScriptSource;

    this.init();
  }

  /**
   * @override
   */
  async handleGetContent() {
    return await this.fakeScriptSource;
  }

  /**
   * @override
   * @param {string} url The full (non-relative) url to resolve.
   * @returns {import("./CollectedImport.js").ResolveImportData}
   */
  handleResolveImport(url) {
    const forceNoFake = url === this.url;
    return { url, forceNoFake };
  }
}
