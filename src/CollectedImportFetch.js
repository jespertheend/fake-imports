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
    let mimeType = null;
    if (response.headers.has("content-type")) {
      mimeType = response.headers.get("content-type");
    }
    const script = await response.text();
    return {
      script,
      mimeType,
    };
  }
}
