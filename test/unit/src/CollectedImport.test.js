import { assertEquals, assertExists, assertRejects, assertStrictEquals, assertThrows } from "asserts";
import { CollectedImport } from "../../../src/CollectedImport.js";

const FAKE_URL = "https://example.com/fake.js";

const basicMockResolver = /** @type {import("../../../src/ImportResolver.js").ImportResolver} */ ({});

const erroringResolver = /** @type {import("../../../src/ImportResolver.js").ImportResolver} */ ({
	/**
	 * @returns {any}
	 */
	createCollectedImport(_url, _options) {
		throw new Error("Mock error");
	},
});

class ExtendecCollectedImport extends CollectedImport {
	handleGetContent() {
		return Promise.resolve({
			script: `
        import "./someUrl.js";
      `,
			mimeType: "text/javascript",
		});
	}
}

Deno.test({
	name: "getCoverageMapEntry throws if generating CoverageMaps is disabled",
	fn() {
		const mockResolver = /** @type {import("../../../src/ImportResolver.js").ImportResolver} */ ({
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
	name: "findShortestCircularImportPath() returns null if the parent is not in the tree of parents",
	fn() {
		const importA = new CollectedImport("a.js", basicMockResolver);
		const importB = new CollectedImport("b.js", basicMockResolver);

		assertEquals(importA.findShortestCircularImportPath(importB), null);
	},
});

Deno.test({
	name: "findShortestCircularImportPath() returns the path if the parent is a direct parent",
	fn() {
		const parent = new CollectedImport("parent.js", basicMockResolver);
		const collectedImport = new CollectedImport(
			"collectedImport.js",
			basicMockResolver,
		);

		collectedImport.addParentCollectedImport(parent);

		const result = collectedImport.findShortestCircularImportPath(parent);
		assertExists(result);
		assertEquals(result.length, 1);
		assertStrictEquals(result[0], parent);
	},
});

Deno.test({
	name: "findShortestCircularImportPath() returns the path if the parent is a parent of a parent",
	fn() {
		const importA = new CollectedImport("a.js", basicMockResolver);

		const importB = new CollectedImport("b.js", basicMockResolver);
		importB.addParentCollectedImport(importA);

		const importC = new CollectedImport("c.js", basicMockResolver);
		importC.addParentCollectedImport(importB);

		const result = importC.findShortestCircularImportPath(importA);
		assertExists(result);
		assertEquals(result.length, 2);
		assertStrictEquals(result[0], importA);
		assertStrictEquals(result[1], importB);
	},
});

Deno.test({
	name: "findShortestCircularImportPath() returns the path if the parent is a parent of a parent of a parent",
	fn() {
		const importA = new CollectedImport("a.js", basicMockResolver);

		const importB = new CollectedImport("b.js", basicMockResolver);
		importB.addParentCollectedImport(importA);

		const importC = new CollectedImport("c.js", basicMockResolver);
		importC.addParentCollectedImport(importB);

		const importD = new CollectedImport("d.js", basicMockResolver);
		importD.addParentCollectedImport(importC);

		const result = importD.findShortestCircularImportPath(importA);
		assertExists(result);
		assertEquals(result.length, 3);
		assertStrictEquals(result[0], importA);
		assertStrictEquals(result[1], importB);
		assertStrictEquals(result[2], importC);
	},
});

Deno.test({
	name: "findShortestCircularImportPath() returns the path if its parent contains another parent",
	fn() {
		const importA = new CollectedImport("a.js", basicMockResolver);
		const importB = new CollectedImport("b.js", basicMockResolver);
		const importC = new CollectedImport("c.js", basicMockResolver);
		importC.addParentCollectedImport(importA);
		importC.addParentCollectedImport(importB);

		const result = importC.findShortestCircularImportPath(importB);
		assertExists(result);
		assertEquals(result.length, 1);
		assertStrictEquals(result[0], importB);
	},
});

Deno.test({
	name: "getAllPathsToRoot() returns a single entry when the module is the root",
	fn() {
		const collectedImport = new CollectedImport("a.js", basicMockResolver);
		collectedImport.markAsRoot();
		assertEquals(collectedImport.getAllPathsToRoot(), [[collectedImport]]);
	},
});

Deno.test({
	name: "getAllPathsToRoot() with one parent",
	fn() {
		const collectedImport = new CollectedImport("a.js", basicMockResolver);
		const parent = new CollectedImport("b.js", basicMockResolver);
		collectedImport.addParentCollectedImport(parent);
		parent.markAsRoot();

		const result = collectedImport.getAllPathsToRoot();
		assertEquals(result, [[parent, collectedImport]]);
	},
});

Deno.test({
	name: "getAllPathsToRoot() with two parents",
	fn() {
		// a   b
		//  \ /
		//   c
		//   |
		//   d
		const importA = new CollectedImport("a.js", basicMockResolver);
		const importB = new CollectedImport("b.js", basicMockResolver);
		const importC = new CollectedImport("c.js", basicMockResolver);
		const importD = new CollectedImport("d.js", basicMockResolver);
		importA.markAsRoot();
		importB.markAsRoot();
		importC.addParentCollectedImport(importA);
		importC.addParentCollectedImport(importB);
		importD.addParentCollectedImport(importC);

		const result = importD.getAllPathsToRoot();
		assertEquals(result, [
			[importA, importC, importD],
			[importB, importC, importD],
		]);
	},
});

Deno.test({
	name: "getAllPathsToRoot() with circular references",
	fn() {
		// a
		// |
		// b <-+
		// |   |
		// c---+
		const importA = new CollectedImport("a.js", basicMockResolver);
		const importB = new CollectedImport("b.js", basicMockResolver);
		const importC = new CollectedImport("c.js", basicMockResolver);
		importA.markAsRoot();
		importB.addParentCollectedImport(importA);
		importC.addParentCollectedImport(importB);
		importB.addParentCollectedImport(importC);

		const result = importC.getAllPathsToRoot();
		assertEquals(result, [
			[importA, importB, importC],
		]);
	},
});

Deno.test({
	name: "getAllPathsToRoot() with circular references, one of which marked as root",
	fn() {
		// a <-+
		// |   |
		// b---+
		const importA = new CollectedImport("a.js", basicMockResolver);
		const importB = new CollectedImport("b.js", basicMockResolver);
		importA.markAsRoot();
		importB.addParentCollectedImport(importA);
		importA.addParentCollectedImport(importB);

		const result = importB.getAllPathsToRoot();
		assertEquals(result, [
			[importA, importB],
		]);
	},
});

Deno.test({
	name: "getShortestPathToRoot() gets the shortest path",
	fn() {
		// a
		// |
		// b   c
		//  \ /
		//   d
		//   |
		//   e
		const importA = new CollectedImport("a.js", basicMockResolver);
		const importB = new CollectedImport("b.js", basicMockResolver);
		const importC = new CollectedImport("c.js", basicMockResolver);
		const importD = new CollectedImport("d.js", basicMockResolver);
		const importE = new CollectedImport("e.js", basicMockResolver);
		importA.markAsRoot();
		importB.addParentCollectedImport(importA);
		importD.addParentCollectedImport(importB);
		importC.markAsRoot();
		importD.addParentCollectedImport(importC);
		importE.addParentCollectedImport(importD);

		const result = importE.getShortestPathToRoot();
		assertEquals(result, [importC, importD, importE]);
	},
});

Deno.test({
	name: "getFirstParentCollectedImport() returns the first parent",
	fn() {
		const importA = new CollectedImport("a.js", basicMockResolver);
		const importB = new CollectedImport("b.js", basicMockResolver);
		const importC = new CollectedImport("c.js", basicMockResolver);
		importC.addParentCollectedImport(importA);
		importC.addParentCollectedImport(importB);

		assertStrictEquals(importC.getFirstParentCollectedImport(), importA);
	},
});

Deno.test({
	name: "getFirstParentCollectedImport() returns null if there are no parents",
	fn() {
		const collectedImport = new CollectedImport("c.js", basicMockResolver);

		assertEquals(collectedImport.getFirstParentCollectedImport(), null);
	},
});

Deno.test({
	name: "initWithErrorHandling() triggers onCreatedBlobUrl callbacks with error when the resolver errors",
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

		await collectedImport.initWithErrorHandling();

		assertEquals(triggerResults.length, 1);
		assertEquals(triggerResults[0].success, false);
	},
});

Deno.test({
	name: "getBlobUrl() rejects when initWithErrorHandling() had an error",
	async fn() {
		const collectedImport = new ExtendecCollectedImport(
			FAKE_URL,
			erroringResolver,
		);

		await collectedImport.initWithErrorHandling();

		await assertRejects(async () => {
			await collectedImport.getBlobUrl();
		});
	},
});

Deno.test({
	name: "initWithErrorHandling() rejects current getBlobUrl() promises once the resolver errors",
	async fn() {
		const collectedImport = new ExtendecCollectedImport(
			FAKE_URL,
			erroringResolver,
		);

		const initPromise = collectedImport.initWithErrorHandling();
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
