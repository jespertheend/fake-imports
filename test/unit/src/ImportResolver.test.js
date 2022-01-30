import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { ImportResolver } from "../../../src/ImportResolver.js";

Deno.test({
  name: "coverageMapOutPath is empty by default",
  fn: () => {
    const importer1 = new ImportResolver("/basepath", {});
    const importer2 = new ImportResolver("/basepath", {}, { env: "deno" });

    assertEquals(importer1.coverageMapOutPath, "");
    assertEquals(importer2.coverageMapOutPath, "");
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

    assertEquals(importer.coverageMapOutPath, "/path/to/coverage");
  },
});

Deno.test({
  name: "generateCoverageMap with options",
  fn: () => {
    const importer = new ImportResolver(
      "/basepath",
      {
        coverageMapOutPath: "/path/to/coverage",
      },
      { env: "deno" },
    );

    assertEquals(importer.coverageMapOutPath, "/path/to/coverage");
  },
});

Deno.test({
  name: "Errors when coverageMapOutPath is provided in browser environment",
  fn: () => {
    let didThrow = false;
    try {
      new ImportResolver(
        "/basepath",
        { coverageMapOutPath: "/coveragePath" },
      );
    } catch {
      didThrow = true;
    }

    assertEquals(didThrow, true);
  },
});

Deno.test({
  name: "forceCoverageMapWriteTimeout is 0 by default",
  fn: () => {
    const importer1 = new ImportResolver("/basepath", {});
    const importer2 = new ImportResolver("/basepath", {}, { env: "deno" });

    assertEquals(importer1.forceCoverageMapWriteTimeout, 0);
    assertEquals(importer2.forceCoverageMapWriteTimeout, 0);
  },
});

Deno.test({
  name: "forceCoverageMapWriteTimeout with option",
  fn: () => {
    const args = [
      "--fi-coverage-map=/path/to/coverage",
    ];
    const importer = new ImportResolver("/basepath", {
      forceCoverageMapWriteTimeout: 1000,
    }, {
      env: "deno",
      args,
    });

    assertEquals(importer.forceCoverageMapWriteTimeout, 1000);
  },
});

Deno.test({
  name: "forceCoverageMapWriteTimeout with argument",
  fn: () => {
    const args = [
      "--fi-coverage-map=/path/to/coverage",
      "--fi-force-coverage-map-write-timeout=1000",
    ];
    const importer = new ImportResolver("/basepath", {}, {
      env: "deno",
      args,
    });

    assertEquals(importer.forceCoverageMapWriteTimeout, 1000);
  },
});

Deno.test({
  name:
    "--fi-force-coverage-map-write-timeout is not usable without --fi-coverage-map",
  fn: () => {
    const args = ["--fi-force-coverage-map-write-timeout=1000"];

    let didThrow = false;
    try {
      new ImportResolver("/basepath", {}, {
        env: "deno",
        args,
      });
    } catch {
      didThrow = true;
    }

    assertEquals(didThrow, true);
  },
});

Deno.test({
  name:
    "forceCoverageMapWriteTimeout option is not usable without --fi-coverage-map",
  fn: () => {
    let didThrow = false;
    try {
      new ImportResolver("/basepath", { forceCoverageMapWriteTimeout: 1000 }, {
        env: "deno",
        args: [],
      });
    } catch {
      didThrow = true;
    }

    assertEquals(didThrow, true);
  },
});
