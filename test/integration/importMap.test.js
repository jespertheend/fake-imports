import { assertEquals, assertRejects, assertThrows } from "asserts";
import { setupScriptTempDir, simpleReplacementDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "basic import map",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {foo} from "barespecifier";
        export {foo};
      `,
      "notabarespecifier.js": `
        export const foo = "foo";
      `,
    }, {
      prefix: "basic_import_map_test",
    });

    try {
      const importer = new Importer(basePath);
      importer.setImportMap({
        imports: {
          "barespecifier": "./notabarespecifier.js",
        },
      });

      const module = await importer.import("main.js");
      assertEquals(module.foo, "foo");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "calling setImportMap() after having already imported something throws",
  async fn() {
    const { cleanup, basePath } = await simpleReplacementDir();

    try {
      const importer = new Importer(basePath);
      const importPromise = importer.import("./main.js");

      assertThrows(() => {
        importer.setImportMap({});
      });

      await importPromise;
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "json file as import map",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {foo} from "barespecifier";
        export {foo};
      `,
      "notabarespecifier.js": `
        export const foo = "foo";
      `,
      "importmap.json": `
        {
          "imports": {
            "barespecifier": "./notabarespecifier.js"
          }
        }
      `,
    }, {
      prefix: "json_file_as_import_map_test",
    });

    try {
      const importer = new Importer(basePath);
      importer.setImportMap("./importmap.json");

      const module = await importer.import("main.js");
      assertEquals(module.foo, "foo");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "specifiers ending with a slash",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {foo} from "lib/mod.js";
        export {foo};
      `,
      "path/to/lib/mod.js": `
        export const foo = "foo";
      `,
    }, {
      prefix: "specifier_ending_with_slash_import_map_test",
    });

    try {
      const importer = new Importer(basePath);
      importer.setImportMap({
        imports: {
          "lib/": "./path/to/lib/",
        },
      });

      const module = await importer.import("main.js");
      assertEquals(module.foo, "foo");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "full url remapping",
  ignore: true,
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {foo} from "https://example.com/mapped.js";
        export {foo};
      `,
      "mapped.js": `
        export const foo = "foo";
      `,
    }, {
      prefix: "import_map_full_url_remapping_test",
    });

    try {
      const importer = new Importer(basePath);
      importer.setImportMap({
        imports: {
          "https://example.com/mapped.js": "./mapped.js",
        },
      });

      const module = await importer.import("main.js");
      assertEquals(module.foo, "foo");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "importing a bare specifier directly without an import map",
  ignore: true,
  async fn() {
    const { cleanup, basePath } = await simpleReplacementDir();

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("bare");
        },
        TypeError,
        `Relative import path "bare" not prefixed with / or ./ or ../`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "importing a bare specifier from a file without an import map",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {foo} from "bare";
        export {foo};
      `,
    }, {
      prefix: "bare_specifier_without_import_map",
    });

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("main.js");
        },
        TypeError,
        `Relative import path "bare" not prefixed with / or ./ or ../`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "importing a bare specifier directly that is not in the import map",
  ignore: true,
  async fn() {
    const { cleanup, basePath } = await simpleReplacementDir();

    try {
      const importer = new Importer(basePath);
      importer.setImportMap({
        imports: {
          "somespecifier": "./somefile.js",
        },
      });
      await assertRejects(
        async () => {
          await importer.import("bare");
        },
        TypeError,
        `Relative import path "bare" not prefixed with / or ./ or ../`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "importing a bare specifier from a file that is not in the import map",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {foo} from "bare";
        export {foo};
      `,
    }, {
      prefix: "bare_specifier_without_import_map",
    });

    try {
      const importer = new Importer(basePath);
      importer.setImportMap({
        imports: {
          "somespecifier": "./somefile.js",
        },
      });
      await assertRejects(
        async () => {
          await importer.import("main.js");
        },
        TypeError,
        `Relative import path "bare" not prefixed with / or ./ or ../`,
      );
    } finally {
      await cleanup();
    }
  },
});
