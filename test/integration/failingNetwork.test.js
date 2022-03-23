import { assertRejects } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "importing non existent file via file import",
  fn: async () => {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import "./does/not/exist.js";
      `,
    }, { prefix: "non_existent_file_via_file_test" });

    const importer = new Importer(basePath);
    await assertRejects(
      async () => {
        await importer.import("./main.js");
      },
      TypeError,
      `Failed to import "${basePath}does/not/exist.js". A network error occurred while fetching the module.`,
    );

    await cleanup();
  },
});

Deno.test({
  name: "importing non existent file via direct import",
  fn: async () => {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import "./does/not/exist.js";
      `,
    }, { prefix: "non_existent_file_via_direct_test" });

    const importer = new Importer(basePath);
    await assertRejects(
      async () => {
        await importer.import("./doesnotexist.js");
      },
      TypeError,
      `Failed to import "${basePath}doesnotexist.js". A network error occurred while fetching the module.`,
    );

    await cleanup();
  },
});
