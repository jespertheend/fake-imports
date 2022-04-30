import { assertEquals, assertRejects } from "asserts";
import { CollectedImportFetch } from "../../../src/CollectedImportFetch.js";
import { installMockFetch, uninstallMockFetch } from "../shared/mockFetch.js";

function createCollectedImport() {
  const stubResolver = {};

  const scriptUrl = "file:///fake.js";

  const collectedImport = new CollectedImportFetch(
    scriptUrl,
    /** @type {any} */ (stubResolver),
  );
  return { collectedImport, scriptUrl };
}

Deno.test({
  name: "handleGetContent() returns the fetch result",
  async fn() {
    const mockFetch = installMockFetch({ responseText: "// script" });
    const { collectedImport, scriptUrl } = createCollectedImport();

    const scriptContent = await collectedImport.handleGetContent();

    assertEquals(scriptContent, {
      script: "// script",
      mimeType: "text/javascript",
    });

    assertEquals(mockFetch.calls, [{ url: scriptUrl, init: undefined }]);

    uninstallMockFetch();
  },
});

Deno.test({
  name: "handleGetContent() with network error",
  async fn() {
    installMockFetch({
      responseText: "// script",
      triggerNetworkError: true,
    });

    const { collectedImport, scriptUrl } = createCollectedImport();

    await assertRejects(
      async () => {
        {
          await collectedImport.handleGetContent();
        }
      },
      TypeError,
      `Failed to import "${scriptUrl}". A network error occurred while fetching the module.`,
    );

    uninstallMockFetch();
  },
});

Deno.test({
  name: "handleGetContent() with 404 status code",
  async fn() {
    installMockFetch({
      responseText: "// script",
      responseCode: 404,
    });

    const { collectedImport, scriptUrl } = createCollectedImport();

    await assertRejects(
      async () => {
        {
          await collectedImport.handleGetContent();
        }
      },
      TypeError,
      `Failed to import "${scriptUrl}". The resource did not respond with an ok status code (404).`,
    );

    uninstallMockFetch();
  },
});

Deno.test({
  name: "handleGetContent() with 500 status code",
  async fn() {
    installMockFetch({
      responseText: "// script",
      responseCode: 500,
    });

    const { collectedImport, scriptUrl } = createCollectedImport();

    await assertRejects(
      async () => {
        {
          await collectedImport.handleGetContent();
        }
      },
      TypeError,
      `Failed to import "${scriptUrl}". The resource did not respond with an ok status code (500).`,
    );

    uninstallMockFetch();
  },
});

Deno.test({
  name: "handleGetContent() with 500 status code and parent importer",
  async fn() {
    installMockFetch({
      responseText: "// script",
      responseCode: 500,
    });

    const { collectedImport, scriptUrl } = createCollectedImport();
    const mockParent = /** @type {CollectedImportFetch} */ ({
      url: "file:///path/to/parent.js",
    });
    collectedImport.addParentCollectedImport(mockParent);

    await assertRejects(
      async () => {
        {
          await collectedImport.handleGetContent();
        }
      },
      TypeError,
      `Failed to import "${scriptUrl}" from "file:///path/to/parent.js". The resource did not respond with an ok status code (500).`,
    );

    uninstallMockFetch();
  },
});
