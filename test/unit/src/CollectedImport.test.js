import { assertEquals, assertRejects, assertThrows } from "asserts";
import { CollectedImport } from "../../../src/CollectedImport.js";

const FAKE_URL = "https://example.com/fake.js";

const basicMockResolver =
  /** @type {import("../../../src/ImportResolver.js").ImportResolver} */ ({});

const erroringResolver =
  /** @type {import("../../../src/ImportResolver.js").ImportResolver} */ ({
    /**
     * @returns {any}
     */
    createCollectedImport(_url, _options) {
      throw new Error("Mock error");
    },
  });

class ExtendecCollectedImport extends CollectedImport {
  handleGetContent() {
    return Promise.resolve(`
          import "./someUrl.js";
        `);
  }
}

Deno.test({
  name: "getCoverageMapEntry throws if generating CoverageMaps is disabled",
  fn() {
    const mockResolver =
      /** @type {import("../../../src/ImportResolver.js").ImportResolver} */ ({
        generateCoverageMap: false,
      });

    const collectedImport = new CollectedImport(
      FAKE_URL,
      mockResolver,
    );
    assertThrows(() => collectedImport.getCoverageMapEntry());
  },
});

Deno.test({
  name:
    "hasParentCollectedImport() returns false if the parent is not in the tree of parents",
  fn() {
    const importA = new CollectedImport(FAKE_URL, basicMockResolver);
    const importB = new CollectedImport(FAKE_URL, basicMockResolver);

    assertEquals(importA.hasParentCollectedImport(importB), false);
  },
});

Deno.test({
  name:
    "hasParentCollectedImport() returns true if the parent is a direct parent",
  fn() {
    const parent = new CollectedImport(FAKE_URL, basicMockResolver);
    const collectedImport = new CollectedImport(FAKE_URL, basicMockResolver);

    collectedImport.addParentCollectedImport(parent);

    assertEquals(collectedImport.hasParentCollectedImport(parent), true);
  },
});

Deno.test({
  name:
    "hasParentCollectedImport() returns true if the parent is a parent of a parent",
  fn() {
    const importA = new CollectedImport(FAKE_URL, basicMockResolver);

    const importB = new CollectedImport(FAKE_URL, basicMockResolver);
    importB.addParentCollectedImport(importA);

    const importC = new CollectedImport(FAKE_URL, basicMockResolver);
    importC.addParentCollectedImport(importB);

    assertEquals(importC.hasParentCollectedImport(importA), true);
  },
});

Deno.test({
  name:
    "hasParentCollectedImport() returns true if the parent is a parent of a parent of a parent",
  fn() {
    const importA = new CollectedImport(FAKE_URL, basicMockResolver);

    const importB = new CollectedImport(FAKE_URL, basicMockResolver);
    importB.addParentCollectedImport(importA);

    const importC = new CollectedImport(FAKE_URL, basicMockResolver);
    importC.addParentCollectedImport(importB);

    const importD = new CollectedImport(FAKE_URL, basicMockResolver);
    importD.addParentCollectedImport(importC);

    assertEquals(importD.hasParentCollectedImport(importA), true);
  },
});

Deno.test({
  name: "hasParentCollectedImport() returns true if",
  fn() {
    const importA = new CollectedImport(FAKE_URL, basicMockResolver);
    const importB = new CollectedImport(FAKE_URL, basicMockResolver);
    const importC = new CollectedImport(FAKE_URL, basicMockResolver);
    importC.addParentCollectedImport(importA);
    importC.addParentCollectedImport(importB);

    assertEquals(importC.hasParentCollectedImport(importB), true);
  },
});

Deno.test({
  name:
    "init() triggers onCreatedBlobUrl callbacks with error when the resolver errors",
  async fn() {
    const collectedImport = new ExtendecCollectedImport(
      FAKE_URL,
      erroringResolver,
    );

    /** @type {import("../../../src/CollectedImport.js").BlobUrlReadyData[]} */
    const triggerResults = [];
    collectedImport.onCreatedBlobUrl((data) => {
      triggerResults.push(data);
    });

    await collectedImport.init();

    assertEquals(triggerResults.length, 1);
    assertEquals(triggerResults[0].success, false);
  },
});

Deno.test({
  name: "getBlobUrl() rejects when init() had an error",
  async fn() {
    const collectedImport = new ExtendecCollectedImport(
      FAKE_URL,
      erroringResolver,
    );

    await collectedImport.init();

    await assertRejects(async () => {
      await collectedImport.getBlobUrl();
    });
  },
});

Deno.test({
  name: "init() rejects current getBlobUrl() promises once the resolver errors",
  async fn() {
    const collectedImport = new ExtendecCollectedImport(
      FAKE_URL,
      erroringResolver,
    );

    const initPromise = collectedImport.init();
    const getBlobUrlPromise = collectedImport.getBlobUrl();

    await initPromise;

    await assertRejects(async () => {
      await getBlobUrlPromise;
    });
  },
});
