import { assert, assertEquals } from "asserts";
import { join } from "https://deno.land/std@0.121.0/path/mod.ts";
import { assertFileCount, simpleReplacementDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "Via api",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();

    const importer = new Importer(basePath, {
      generateCoverageMap: true,
    });
    await importer.import("./main.js");

    const coverageMap = importer.getCoverageMap();
    assertEquals(Array.from(Object.entries(coverageMap)).length, 2);

    const mappedUrls = [];
    for (const [key, entry] of Object.entries(coverageMap)) {
      assert(
        key.startsWith("blob:"),
        "Coverage map keys should always start with blob:",
      );
      mappedUrls.push(entry.originalUrl);
    }
    mappedUrls.sort();

    assertEquals(mappedUrls, [
      `${basePath}main.js`,
      `${basePath}replaced.js`,
    ]);

    await cleanup();
  },
});

Deno.test({
  name: "Via api callback",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();
    const importer = new Importer(basePath, {
      generateCoverageMap: true,
    });
    /** @type {import("../../mod.js").CoverageMapEntry[]} */
    const firedEvents = [];

    importer.onCoverageMapEntryAdded((entry) => {
      firedEvents.push(entry);
    });

    await importer.import("./main.js");

    assertEquals(firedEvents.length, 2);
    const mappedUrls = firedEvents.map((e) => e.originalUrl);
    mappedUrls.sort();
    assertEquals(mappedUrls, [
      `${basePath}main.js`,
      `${basePath}replaced.js`,
    ]);

    await cleanup();
  },
});

Deno.test({
  name: "Removing api callback",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();
    const importer = new Importer(basePath);
    let callCount = 0;
    const callback = () => {
      callCount++;
    };

    importer.onCoverageMapEntryAdded(callback);
    importer.removeOnCoverageMapEntryAdded(callback);
    await importer.import("./main.js");

    assertEquals(callCount, 0);

    await cleanup();
  },
});

/**
 * @param {string} path
 */
async function pathExists(path) {
  let exists = false;
  try {
    await Deno.stat(path);
    exists = true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      exists = false;
    } else {
      throw e;
    }
  }
  return exists;
}

Deno.test({
  name: "Via api with relative output path",
  fn: async () => {
    const { cleanup, basePath, dirPath } = await simpleReplacementDir();
    const importer = new Importer(basePath, {
      coverageMapOutPath: "./coverage",
    });
    await importer.import("./main.js");

    const fullOutputPath = join(dirPath, "coverage");
    const exists = await pathExists(fullOutputPath);
    assert(exists, "basePath/coverage should exist");

    assertFileCount(fullOutputPath, 2);

    await Deno.remove(fullOutputPath, { recursive: true });
    await cleanup();
  },
});

Deno.test({
  name: "Via api with absolute output path",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();
    const tempDir = await Deno.makeTempDir();
    const fullOutputPath = join(tempDir, "coverage");
    const importer = new Importer(basePath, {
      coverageMapOutPath: fullOutputPath,
    });
    await importer.import("./main.js");

    const exists = await pathExists(fullOutputPath);
    assert(exists, "coverage dir should exist");

    assertFileCount(fullOutputPath, 2);

    await Deno.remove(tempDir, { recursive: true });
    await cleanup();
  },
});

Deno.test({
  name: "Coverage map contents",
  fn: async () => {
    const { cleanup, basePath, dirPath } = await simpleReplacementDir();
    const importer = new Importer(basePath, {
      coverageMapOutPath: "./coverage",
    });
    await importer.import("./main.js");

    const fullOutputPath = join(dirPath, "coverage");

    const fileContents = [];
    for await (const file of Deno.readDir(fullOutputPath)) {
      if (!file.isFile) continue;
      const content = await Deno.readTextFile(join(fullOutputPath, file.name));
      fileContents.push(JSON.parse(content));
    }

    const mappedUrls = fileContents.map((e) => e.originalUrl);
    mappedUrls.sort();
    assertEquals(mappedUrls, [
      `${basePath}main.js`,
      `${basePath}replaced.js`,
    ]);

    await cleanup();
  },
});
