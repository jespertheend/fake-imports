import { CollectedImport } from "./CollectedImport.js";

export class CollectedImportFetch extends CollectedImport {
  /**
   * @override
   */
  async handleGetContent() {
    let response = null;
    let failedToImportMessage = `Failed to import "${this.url}"`;
    const parent = this.getFirstParentCollectedImport();
    if (parent) {
      failedToImportMessage += ` from "${parent.url}".`;
    } else {
      failedToImportMessage += ".";
    }
    try {
      response = await fetch(this.url);
    } catch {
      throw new TypeError(
        `${failedToImportMessage} A network error occurred while fetching the module.`,
      );
    }
    if (!response.ok) {
      throw new TypeError(
        `${failedToImportMessage} The resource did not respond with an ok status code (${response.status}).`,
      );
    }
    return await response.text();
  }
}
