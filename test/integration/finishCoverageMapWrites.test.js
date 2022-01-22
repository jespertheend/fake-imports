import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { Importer } from "../../mod.js";
import { simpleReplacementDir } from "./shared.js";
import { join } from "https://deno.land/std@0.121.0/path/mod.ts";

Deno.test({
  name: "Should resolve when coverage maps are disabled",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();

    const importer = new Importer(basePath);
    importer.fakeModule("./replaced.js", `export const replaced = "replaced";`);
    await importer.import("./main.js");

    await importer.finishCoverageMapWrites();

    await cleanup();
  },
});

Deno.test({
  name: "Should resolve when coverage maps are enabled",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();
    const importer = new Importer(basePath, {
      coverageMapOutPath: "./coverage",
    });
    await importer.import("./main.js");

    await importer.finishCoverageMapWrites();

    await cleanup();
  },
});

Deno.test({
  name: "Should not resolve untill all files are written",
  fn: async () => {
    const { cleanup, basePath, dirPath } = await simpleReplacementDir();
    const importer = new Importer(basePath, {
      coverageMapOutPath: "./coverage",
    });
    await importer.import("./main.js");

    await importer.finishCoverageMapWrites();

    const fullOutputPath = join(dirPath, "coverage");
    let fileCount = 0;
    for await (const file of Deno.readDir(fullOutputPath)) {
      if (!file.isFile) continue;
      fileCount++;
    }
    assertEquals(fileCount, 2);

    await cleanup();
  },
});
