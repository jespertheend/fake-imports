import { assertEquals } from "asserts";
import { simpleReplacementDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "No arguments",
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
