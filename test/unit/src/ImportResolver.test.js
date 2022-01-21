// @ts-check

import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { ImportResolver } from "../../../src/ImportResolver.js";

Deno.test({
  name: "generateCoverageMap is false by default",
  fn: () => {
    const importer1 = new ImportResolver("/basepath", {});
    const importer2 = new ImportResolver("/basepath", {}, { env: "deno" });

    assertEquals(importer1.generateCoverageMap, false);
    assertEquals(importer2.generateCoverageMap, false);
  },
});

Deno.test({
  name: "generateCoverageMap with argument",
  fn: () => {
    const importer = new ImportResolver("/basepath", {}, {
      env: "deno",
      args: [
        "--fi-coverage-map=/path/to/coverage",
      ],
    });

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
    );
    const importer2 = new ImportResolver(
      "/basepath",
      {
        generateCoverageMap: true,
        coverageMapOutPath: "/path/to/coverage",
      },
      { env: "deno" },
    );

    assertEquals(importer1.generateCoverageMap, true);
    assertEquals(importer1.coverageMapOutPath, "");

    assertEquals(importer2.generateCoverageMap, true);
    assertEquals(importer2.coverageMapOutPath, "/path/to/coverage");
  },
});

Deno.test({
  name: "coverageMapOutPath should force generateCoverageMap option to true",
  fn: () => {
    const importer = new ImportResolver(
      "/basPath",
      {
        coverageMapOutPath: "/path/to/coverage",
      },
      { env: "deno" },
    );

    assertEquals(importer.generateCoverageMap, true);
    assertEquals(importer.coverageMapOutPath, "/path/to/coverage");
  },
});

Deno.test({
  name:
    "generateCoverageMap=false and coverageMapOutPath should not be compatible",
  fn: () => {
    let didThrow = false;
    try {
      new ImportResolver(
        "/basPath",
        {
          generateCoverageMap: false,
          coverageMapOutPath: "/path/to/coverage",
        },
        { env: "deno" },
      );
    } catch {
      didThrow = true;
    }
    assertEquals(didThrow, true);
  },
});

Deno.test({
  name: "generateCoverageMap is false when set, regardless of arguments",
  fn: () => {
    const importer1 = new ImportResolver(
      "/basepath",
      { generateCoverageMap: false },
      { env: "deno" },
    );
    const importer2 = new ImportResolver(
      "/basepath",
      { generateCoverageMap: false },
      {
        env: "deno",
        args: ["--fi-coverage-map=/path/to/coverage"],
      },
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
      );
    } catch {
      didThrow = true;
    }

    assertEquals(didThrow, true);
  },
});
