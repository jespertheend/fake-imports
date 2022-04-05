import { assertEquals } from "asserts";
import { setupScriptTempDir, simpleReplacementDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "Simple",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();

    const importer = new Importer(basePath);
    importer.fakeModule("./replaced.js", `export const replaced = "replaced";`);
    const main = await importer.import("./main.js");

    assertEquals(main.replaced, "replaced");

    await cleanup();
  },
});

Deno.test({
  name: "fakeModule() with a URL object",
  async fn() {
    const { cleanup, basePath } = await simpleReplacementDir();

    const importer = new Importer(basePath);
    const url = new URL("./replaced.js", basePath);
    importer.fakeModule(url, `export const replaced = "replaced";`);
    const main = await importer.import("./main.js");

    assertEquals(main.replaced, "replaced");

    await cleanup();
  },
});

Deno.test({
  name: "URL Object as argument",
  fn: async () => {
    const { cleanup, basePath } = await simpleReplacementDir();

    const basePathUrl = new URL(basePath);
    const importer = new Importer(basePathUrl);
    importer.fakeModule("./replaced.js", `export const replaced = "replaced";`);
    const main = await importer.import("./main.js");

    assertEquals(main.replaced, "replaced");

    await cleanup();
  },
});

Deno.test({
  name: "Multiple imports from the same file",
  fn: async () => {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {replaced as a} from "./a.js";
        import {replaced as b} from "./b.js";

        export {a, b};
      `,
      "a.js": `
        import {replaced} from "./replaced.js";
        export {replaced};
      `,
      "b.js": `
        import {replaced} from "./replaced.js";
        export {replaced};
      `,
      "replaced.js": `
        export const replaced = "not replaced";
      `,
    }, { prefix: "multiple_imports_from_same_file_test" });

    const importer = new Importer(basePath);
    importer.fakeModule("./replaced.js", `export const replaced = "replaced";`);
    const { a, b } = await importer.import("./main.js");

    assertEquals({ a, b }, { a: "replaced", b: "replaced" });

    await cleanup();
  },
});

Deno.test({
  name: "Module that re-exports a module",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        export {foo} from "./foo.js";
      `,
      "foo.js": `
        export const foo = "foo";
      `,
    }, { prefix: "module_that_reexports_a_module" });

    const importer = new Importer(basePath);
    const { foo } = await importer.import("./main.js");

    assertEquals(foo, "foo");

    await cleanup();
  },
});
