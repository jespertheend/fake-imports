import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { CollectedImportFake } from "../../../src/CollectedImportFake.js";

const originalFetch = globalThis.fetch;

function installSpyFetch(responseText = "") {
  const spyFetchData = {
    calls:
      /** @type {{url: RequestInfo, init: RequestInit | undefined}[]} */ ([]),
  };
  /**
   * @param {RequestInfo} url
   * @param {RequestInit} [init]
   */
  const spyFetch = async (url, init) => {
    await new Promise((r) => r(null));
    spyFetchData.calls.push({ url, init });
    return /** @type {Response} */ ({
      text: () => new Promise((r) => r(responseText)),
    });
  };
  globalThis.fetch = /** @type {typeof fetch} */ (spyFetch);
  return spyFetchData;
}

function uninstallSpyFetch() {
  globalThis.fetch = originalFetch;
}

/**
 * @param {import("../../../mod.js").ModuleImplementation} fakeModuleImplementation
 * @returns
 */
function createCollectedImport(fakeModuleImplementation = () => "") {
  const stubResolver = {};
  // fake the init method
  CollectedImportFake.prototype.init = async () => {};

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
    const spyFetch = installSpyFetch("original");
    const { collectedImport, scriptUrl } = createCollectedImport(() => "fake");

    const originalContent = await collectedImport.handleGetOriginalContent();

    assertEquals(originalContent, "original");

    assertEquals(spyFetch.calls, [{ url: scriptUrl, init: undefined }]);

    uninstallSpyFetch();
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
  installSpyFetch();
  const fakeContent = "new fake content";
  const { collectedImport } = createCollectedImport(() => fakeContent);

  const getContentResult = await collectedImport.handleGetContent();
  assertEquals(getContentResult, fakeContent);

  uninstallSpyFetch();
});

Deno.test("handleGetContent with args", async () => {
  const originalContent = "old original content";
  const fakeContent = "new fake content";
  const spyFetch = installSpyFetch(originalContent);

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

  assertEquals(spyFetch.calls, [{ url: scriptUrl, init: undefined }]);

  uninstallSpyFetch();
});

Deno.test({
  name: "Fetch is only called once",
  async fn() {
    const spyFetch = installSpyFetch("original");
    const { collectedImport, scriptUrl } = createCollectedImport(() => "fake");

    collectedImport.handleGetOriginalContent();
    await collectedImport.handleGetContent();

    assertEquals(spyFetch.calls, [{ url: scriptUrl, init: undefined }]);

    uninstallSpyFetch();
  },
});
