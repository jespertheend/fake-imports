import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { ImportResolver } from "../../../src/ImportResolver.js";

Deno.test({
  name: "generateCoverageMap is false by default",
  fn: () => {
    const importer1 = new ImportResolver("/basepath", {}, "browser", []);
    const importer2 = new ImportResolver("/basepath", {}, "deno", []);

    assertEquals(importer1.generateCoverageMap, false);
    assertEquals(importer2.generateCoverageMap, false);
  },
});

Deno.test({
  name: "generateCoverageMap with argument",
  fn: () => {
    const importer = new ImportResolver("/basepath", {}, "deno", [
      "--coverage=/path/to/coverage",
    ]);

    assertEquals(importer.generateCoverageMap, true);
    assertEquals(importer.coverageMapOutPath, "/path/to/coverage");
  },
});

Deno.test({
  name: "generateCoverageMap with options",
  fn: () => {
    const importer1 = new ImportResolver(
      "/basepath",
      {
        generateCoverageMap: true,
      },
      "browser",
      [],
    );
    const importer2 = new ImportResolver(
      "/basepath",
      {
        generateCoverageMap: true,
        coverageMapOutPath: "/path/to/coverage",
      },
      "deno",
      [],
    );

    assertEquals(importer1.generateCoverageMap, true);
    assertEquals(importer1.coverageMapOutPath, "");

    assertEquals(importer2.generateCoverageMap, true);
    assertEquals(importer2.coverageMapOutPath, "/path/to/coverage");
  },
});

Deno.test({
  name: "generateCoverageMap is false when set, regardless of arguments",
  fn: () => {
    const importer1 = new ImportResolver(
      "/basepath",
      { generateCoverageMap: false },
      "browser",
      [],
    );
    const importer2 = new ImportResolver(
      "/basepath",
      { generateCoverageMap: false },
      "deno",
      ["--coverage=/path/to/coverage"],
    );

    assertEquals(importer1.generateCoverageMap, false);
    assertEquals(importer1.coverageMapOutPath, "");

    assertEquals(importer2.generateCoverageMap, false);
    assertEquals(importer2.coverageMapOutPath, "");
  },
});

Deno.test({
  name: "Errors when coverageMapOutPath is provided in browser environment",
  fn: () => {
    let didThrow = false;
    try {
      new ImportResolver(
        "/basepath",
        { coverageMapOutPath: "/coveragePath", generateCoverageMap: true },
        "browser",
        [],
      );
    } catch {
      didThrow = true;
    }

    assertEquals(didThrow, true);
  },
});
