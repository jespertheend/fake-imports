import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { simpleReplacementDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "No arguments",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();

    const importer = new Importer(basePath);
    importer.fakeModule(
      "./replaced.js",
      () => `export const replaced = "replaced";`,
    );
    const main = await importer.import("./main.js");

    assertEquals(main.replaced, "replaced");

    await cleanup();
  },
});

Deno.test({
  name: "Take fullContent",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();

    const importer = new Importer(basePath);
    importer.fakeModule(
      "./replaced.js",
      (original) => {
        return original.fullContent.replace(`"not replaced"`, `"replaced"`);
      },
    );
    const main = await importer.import("./main.js");

    assertEquals(main.replaced, "replaced");

    await cleanup();
  },
});
