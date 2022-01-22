import { Importer } from "../../mod.js";
import { assertFileCount, simpleReplacementDir } from "./shared.js";
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
    const fullOutputPath = join(dirPath, "coverage");
    const importer = new Importer(basePath, {
      coverageMapOutPath: "./coverage",
      forceCoverageMapWriteTimeout: 500,
    });
    await importer.import("./main.js");

    assertFileCount(fullOutputPath, 0);

    await importer.finishCoverageMapWrites();

    assertFileCount(fullOutputPath, 2);

    await cleanup();
  },
});
