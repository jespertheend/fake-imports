import { assertEquals } from "asserts";
import { CollectedImportFake } from "../../../src/CollectedImportFake.js";
import { installMockFetch, uninstallMockFetch } from "../shared/mockFetch.js";

/**
 * @param {import("../../../mod.js").ModuleImplementation} fakeModuleImplementation
 * @returns
 */
function createCollectedImport(fakeModuleImplementation = () => "") {
  const stubResolver = {};

  const scriptUrl = "file:///fake.js";

  const collectedImport = new CollectedImportFake(
    fakeModuleImplementation,
    scriptUrl,
    /** @type {any} */ (stubResolver),
  );
  return { collectedImport, scriptUrl };
}

Deno.test({
  name: "handleGetOriginalContent",
  async fn() {
    const mockFetch = installMockFetch({ responseText: "original" });
    const { collectedImport, scriptUrl } = createCollectedImport(() => "fake");

    const originalContent = await collectedImport.handleGetOriginalContent();

    assertEquals(originalContent, "original");

    assertEquals(mockFetch.calls, [{ url: scriptUrl, init: undefined }]);

    uninstallMockFetch();
  },
});

Deno.test({
  name: "handleGetOriginalContent network error",
  async fn() {
    const mockFetch = installMockFetch({
      responseText: "original",
      triggerNetworkError: true,
    });
    const { collectedImport, scriptUrl } = createCollectedImport(() => "fake");

    const originalContent = await collectedImport.handleGetOriginalContent();

    assertEquals(originalContent, "");

    assertEquals(mockFetch.calls, [{ url: scriptUrl, init: undefined }]);

    uninstallMockFetch();
  },
});

Deno.test("handleResolveImport", () => {
  const { collectedImport, scriptUrl } = createCollectedImport();

  const resolveData = collectedImport.handleResolveImport(scriptUrl);
  assertEquals(resolveData, {
    url: scriptUrl,
    allowFakes: false,
  });
});

Deno.test("handleGetContent no args", async () => {
  installMockFetch();
  const fakeContent = "new fake content";
  const { collectedImport } = createCollectedImport(() => fakeContent);

  const getContentResult = await collectedImport.handleGetContent();
  assertEquals(getContentResult, fakeContent);

  uninstallMockFetch();
});

Deno.test("handleGetContent with args", async () => {
  const originalContent = "old original content";
  const fakeContent = "new fake content";
  const mockFetch = installMockFetch({ responseText: originalContent });

  let receivedOriginalData = null;
  const { collectedImport, scriptUrl } = createCollectedImport(
    (originalData) => {
      receivedOriginalData = originalData;
      return fakeContent;
    },
  );

  const getContentResult = await collectedImport.handleGetContent();
  assertEquals(getContentResult, fakeContent);

  assertEquals(receivedOriginalData, {
    url: scriptUrl,
    fullContent: originalContent,
  });

  assertEquals(mockFetch.calls, [{ url: scriptUrl, init: undefined }]);

  uninstallMockFetch();
});

Deno.test({
  name: "Fetch is only called once",
  async fn() {
    const mockFetch = installMockFetch({ responseText: "original" });
    const { collectedImport, scriptUrl } = createCollectedImport(() => "fake");

    collectedImport.handleGetOriginalContent();
    await collectedImport.handleGetContent();

    assertEquals(mockFetch.calls, [{ url: scriptUrl, init: undefined }]);

    uninstallMockFetch();
  },
});
