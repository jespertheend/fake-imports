import {
  assertEquals,
  assertExists,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "asserts";
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
    "findClosestCircularImportPath() returns null if the parent is not in the tree of parents",
  fn() {
    const importA = new CollectedImport("a.js", basicMockResolver);
    const importB = new CollectedImport("b.js", basicMockResolver);

    assertEquals(importA.findClosestCircularImportPath(importB), null);
  },
});

Deno.test({
  name:
    "findClosestCircularImportPath() returns the path if the parent is a direct parent",
  fn() {
    const parent = new CollectedImport("parent.js", basicMockResolver);
    const collectedImport = new CollectedImport(
      "collectedImport.js",
      basicMockResolver,
    );

    collectedImport.addParentCollectedImport(parent);

    const result = collectedImport.findClosestCircularImportPath(parent);
    assertExists(result);
    assertEquals(result.length, 1);
    assertStrictEquals(result[0], parent);
  },
});

Deno.test({
  name:
    "findClosestCircularImportPath() returns the path if the parent is a parent of a parent",
  fn() {
    const importA = new CollectedImport("a.js", basicMockResolver);

    const importB = new CollectedImport("b.js", basicMockResolver);
    importB.addParentCollectedImport(importA);

    const importC = new CollectedImport("c.js", basicMockResolver);
    importC.addParentCollectedImport(importB);

    const result = importC.findClosestCircularImportPath(importA);
    assertExists(result);
    assertEquals(result.length, 2);
    assertStrictEquals(result[0], importA);
    assertStrictEquals(result[1], importB);
  },
});

Deno.test({
  name:
    "findClosestCircularImportPath() returns the path if the parent is a parent of a parent of a parent",
  fn() {
    const importA = new CollectedImport("a.js", basicMockResolver);

    const importB = new CollectedImport("b.js", basicMockResolver);
    importB.addParentCollectedImport(importA);

    const importC = new CollectedImport("c.js", basicMockResolver);
    importC.addParentCollectedImport(importB);

    const importD = new CollectedImport("d.js", basicMockResolver);
    importD.addParentCollectedImport(importC);

    const result = importD.findClosestCircularImportPath(importA);
    assertExists(result);
    assertEquals(result.length, 3);
    assertStrictEquals(result[0], importA);
    assertStrictEquals(result[1], importB);
    assertStrictEquals(result[2], importC);
  },
});

Deno.test({
  name:
    "findClosestCircularImportPath() returns the path if its parent contains another parent",
  fn() {
    const importA = new CollectedImport("a.js", basicMockResolver);
    const importB = new CollectedImport("b.js", basicMockResolver);
    const importC = new CollectedImport("c.js", basicMockResolver);
    importC.addParentCollectedImport(importA);
    importC.addParentCollectedImport(importB);

    const result = importC.findClosestCircularImportPath(importB);
    assertExists(result);
    assertEquals(result.length, 1);
    assertStrictEquals(result[0], importB);
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

Deno.test({
  name: "getFileName() returns the file name of the script",
  fn() {
    const collectedImport = new CollectedImport(
      "https://example.com/foo.js",
      basicMockResolver,
    );

    assertEquals(collectedImport.getFileName(), "foo.js");
  },
});

Deno.test({
  name: "getFileName() returns the full domain if the url doesn't have a path",
  fn() {
    const collectedImport = new CollectedImport(
      "https://example.com",
      basicMockResolver,
    );

    assertEquals(collectedImport.getFileName(), "https://example.com");
  },
});
