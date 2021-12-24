import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { toFileUrl } from "https://deno.land/std@0.119.0/path/mod.ts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

async function simpleReplacementDir() {
  return await setupScriptTempDir({
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
}

Deno.test({
  name: "Simple",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, dirPath } = await simpleReplacementDir();

    const basePath = toFileUrl(dirPath) + "/";
    const importer = new Importer(basePath);
    importer.fakeModule("./replaced.js", `export const replaced = "replaced";`);
    const main = await importer.import("./main.js");

    assertEquals(main.replaced, "replaced");

    await cleanup();
  },
});

Deno.test({
  name: "URL Object as argument",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, dirPath } = await simpleReplacementDir();

    const basePathStr = toFileUrl(dirPath) + "/";
    const basePath = new URL(basePathStr);
    const importer = new Importer(basePath);
    importer.fakeModule("./replaced.js", `export const replaced = "replaced";`);
    const main = await importer.import("./main.js");

    assertEquals(main.replaced, "replaced");

    await cleanup();
  },
});

Deno.test({
  name: "Multiple imports from the same file",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, dirPath } = await setupScriptTempDir({
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

    const basePath = toFileUrl(dirPath) + "/";
    const importer = new Importer(basePath);
    importer.fakeModule("./replaced.js", `export const replaced = "replaced";`);
    const { a, b } = await importer.import("./main.js");

    assertEquals({ a, b }, { a: "replaced", b: "replaced" });

    await cleanup();
  },
});

Deno.test({
  name: "Import twice",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, dirPath } = await setupScriptTempDir({
      "main.js": `
        import {mutable} from "./replaced.js";
        export {mutable};
      `,
      "replaced.js": `
        export const mutable = {changedBy: "not changed"};
      `,
    }, {
      prefix: "import_twice_test",
    });

    const basePath = toFileUrl(dirPath) + "/";
    const importer = new Importer(basePath);
    importer.fakeModule(
      "./replaced.js",
      `export const mutable = {changedBy: "fake"};`,
    );

    const firstModule = await importer.import("./main.js");
    firstModule.mutable.changedBy = "first import";
    const secondModule = await importer.import("./main.js");

    assertEquals(secondModule.mutable.changedBy, "first import");

    await cleanup();
  },
});

Deno.test({
  name: "Fake that imports itself",
  permissions: {
    net: true,
  },
  fn: async () => {
    const { cleanup, dirPath } = await setupScriptTempDir({
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

    const basePath = toFileUrl(dirPath) + "/";
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
