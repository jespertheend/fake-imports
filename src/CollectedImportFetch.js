// @ts-check

import { CollectedImport } from "./CollectedImport.js";

export class CollectedImportFetch extends CollectedImport {
  /**
   * @override
   */
  async handleGetContent() {
    const response = await fetch(this.url);
    return await response.text();
  }
}
