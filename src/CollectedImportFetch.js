import { fetchWithErrorHandling } from "./shared.js";
import { CollectedImport } from "./CollectedImport.js";

export class CollectedImportFetch extends CollectedImport {
  /**
   * @override
   */
  async handleGetContent() {
    let failedToImportMessage = `Failed to import "${this.url}"`;
    const parent = this.getFirstParentCollectedImport();
    if (parent) {
      failedToImportMessage += ` from "${parent.url}".`;
    } else {
      failedToImportMessage += ".";
    }
    const response = await fetchWithErrorHandling({
      errorMessagePrefix: failedToImportMessage,
      fetchArgs: [this.url],
    });
    return await response.text();
  }
}
