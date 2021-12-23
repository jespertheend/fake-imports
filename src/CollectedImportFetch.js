import { CollectedImport } from "./CollectedImport.js";

export class CollectedImportFetch extends CollectedImport {
  /**
   * @param {ConstructorParameters<typeof CollectedImport>} args
   */
  constructor(...args) {
    super(...args);

    this.init();
  }

  /**
   * @override
   */
  async handleGetContent() {
    const response = await fetch(this.url);
    return await response.text();
  }
}
