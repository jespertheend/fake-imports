// @ts-check

import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { join } from "https://deno.land/std@0.121.0/path/mod.ts";
import { setupScriptTempDir } from "./shared.js";
import { applyCoverage } from "../../applyCoverage.js";

Deno.test({
  name: "Url replacement",
  fn: async () => {
    const { cleanup, dirPath } = await setupScriptTempDir({
      "denoCoverage/denoCoverageFile.json": JSON.stringify({
        url: "blob:null/00000000-0000-0000-0000-000000000000",
      }),
      "fakeImportsCoverage/coverageMapFile.json": JSON.stringify({
        replacedUrl: "blob:null/00000000-0000-0000-0000-000000000000",
        originalUrl: "file:///original/file.js",
      }),
    });

    const coverageMapPath = join(dirPath, "fakeImportsCoverage");
    const denoCoveragePath = join(dirPath, "denoCoverage");
    await applyCoverage(coverageMapPath, denoCoveragePath);

    const denoCoverageFilePath = join(
      denoCoveragePath,
      "denoCoverageFile.json",
    );
    const newJsonContent = await Deno.readTextFile(denoCoverageFilePath);
    const newJson = JSON.parse(newJsonContent);

    assertEquals(newJson, {
      url: "file:///original/file.js",
    });

    await cleanup();
  },
});

Deno.test({
  name: "Map indices",
  fn: async () => {
    const { cleanup, dirPath } = await setupScriptTempDir({
      "denoCoverage/denoCoverageFile.json": JSON.stringify({
        url: "blob:null/00000000-0000-0000-0000-000000000000",
        functions: [
          {
            functionName: "foo",
            ranges: [
              {
                startOffset: 0,
                endOffset: 5,
                count: 1,
              },
              {
                startOffset: 15,
                endOffset: 25,
                count: 1,
              },
            ],
            isBlockCoverage: false,
          },
        ],
      }),
      "fakeImportsCoverage/coverageMapFile.json": JSON.stringify({
        replacedUrl: "blob:null/00000000-0000-0000-0000-000000000000",
        originalUrl: "file:///original/file.js",
        diffOffsets: [
          [0, 0],
          [10, null],
          [20, -10],
        ],
      }),
    });

    const coverageMapPath = join(dirPath, "fakeImportsCoverage");
    const denoCoveragePath = join(dirPath, "denoCoverage");
    await applyCoverage(coverageMapPath, denoCoveragePath);

    const denoCoverageFilePath = join(
      denoCoveragePath,
      "denoCoverageFile.json",
    );
    const newJsonContent = await Deno.readTextFile(denoCoverageFilePath);
    const newJson = JSON.parse(newJsonContent);

    assertEquals(newJson, {
      url: "file:///original/file.js",
      functions: [{
        functionName: "foo",
        ranges: [
          {
            startOffset: 0,
            endOffset: 5,
            count: 1,
          },
          {
            startOffset: 10,
            endOffset: 15,
            count: 1,
          },
        ],
        isBlockCoverage: false,
      }],
    });

    await cleanup();
  },
});
