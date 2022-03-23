import { CollectedImport } from "./CollectedImport.js";

export class CollectedImportFetch extends CollectedImport {
  /**
   * @override
   */
  async handleGetContent() {
    let response = null;
    try {
      response = await fetch(this.url);
    } catch {
      throw new TypeError(
        `Failed to import "${this.url}". A network error occurred while fetching the module.`,
      );
    }
    if (!response.ok) {
      throw new TypeError(
        `Failed to import "${this.url}". The resource did not respond with an ok status code (${response.status}).`,
      );
    }
    return await response.text();
  }
}
