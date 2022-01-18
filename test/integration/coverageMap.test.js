import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { simpleReplacementDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "Via api",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();

    const importer = new Importer(basePath);
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
