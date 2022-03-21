import { assertEquals } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "Fake that imports itself",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {mutable} from "./replaced.js";
        export {mutable};
      `,
      "replaced.js": `
        export const mutable = {changedBy: "not changed"};
      `,
    }, {
      prefix: "import_self_test",
    });

    const importer = new Importer(basePath);
    importer.fakeModule(
      "./replaced.js",
      `
      import {mutable} from "./replaced.js";
      mutable.changedBy = "fake";
      export {mutable};
    `,
    );

    const main = await importer.import("./main.js");
    assertEquals(main.mutable.changedBy, "fake");

    await cleanup();
  },
});
