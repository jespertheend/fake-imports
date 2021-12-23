import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { toFileUrl } from "https://deno.land/std@0.119.0/path/mod.ts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "Simple",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, dirPath } = await setupScriptTempDir({
      "main.js": `
      import {replaced} from "./replaced.js";
      export {replaced};
    `,
      "replaced.js": `
      export const replaced = "not replaced";
    `,
    }, {
      prefix: "simple_replacement_test",
    });

    const basePath = toFileUrl(dirPath) + "/";
    const importer = new Importer(basePath);
    importer.fakeModule("./replaced.js", `export const replaced = "replaced";`);
    const main = await importer.import("./main.js");

    assertEquals(main.replaced, "replaced");

    await cleanup();
  },
});
