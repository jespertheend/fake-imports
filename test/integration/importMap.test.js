import { assertEquals, assertRejects } from "asserts";
import { setupScriptTempDir, simpleReplacementDir } from "./shared.js";
import { Importer } from "../../mod.js";
import {
  installMockFetch,
  uninstallMockFetch,
} from "../unit/shared/mockFetch.js";

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
      const importer = new Importer(basePath, {
        importMap: {
          imports: {
            "barespecifier": "./notabarespecifier.js",
          },
        },
      });

      const module = await importer.import("./main.js");
      assertEquals(module.foo, "foo");
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
      const importer = new Importer(basePath, {
        importMap: "./importmap.json",
      });

      const module = await importer.import("./main.js");
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
      const importer = new Importer(basePath, {
        importMap: {
          imports: {
            "lib/": "./path/to/lib/",
          },
        },
      });

      const module = await importer.import("./main.js");
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
      const importer = new Importer(basePath, {
        importMap: {
          imports: {
            "https://example.com/mapped.js": "./mapped.js",
          },
        },
      });

      const module = await importer.import("./main.js");
      assertEquals(module.foo, "foo");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "importing a bare specifier directly without an import map",
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
          await importer.import("./main.js");
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
  async fn() {
    const { cleanup, basePath } = await simpleReplacementDir();

    try {
      const importer = new Importer(basePath, {
        importMap: {
          imports: {
            "somespecifier": "./somefile.js",
          },
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
      prefix: "bare_specifier_not_in_import_map",
    });

    try {
      const importer = new Importer(basePath, {
        importMap: {
          imports: {
            "somespecifier": "./somefile.js",
          },
        },
      });
      await assertRejects(
        async () => {
          await importer.import("./main.js");
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
  name: "providing a non-existent import map path",
  async fn() {
    const { cleanup, basePath } = await simpleReplacementDir();

    try {
      const importMapFileName = "nonexistent.json";
      const importer = new Importer(basePath, {
        importMap: importMapFileName,
      });
      const fullImportPath = new URL(importMapFileName, basePath);
      await assertRejects(
        async () => {
          await importer.import("./main.js");
        },
        TypeError,
        `Failed install import map from "${fullImportPath}". A network error occurred while fetching the module.`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "fetching online import path with 404 status code",
  async fn() {
    const { cleanup, basePath } = await simpleReplacementDir();

    installMockFetch({
      responseText: "// script",
      responseCode: 404,
    });

    try {
      const importMapFileName = "nonexistent.json";
      const importer = new Importer(basePath, {
        importMap: importMapFileName,
      });
      const fullImportPath = new URL(importMapFileName, basePath);
      await assertRejects(
        async () => {
          await importer.import("./main.js");
        },
        TypeError,
        `Failed install import map from "${fullImportPath}". The resource did not respond with an ok status code (404).`,
      );
    } finally {
      await cleanup();
      uninstallMockFetch();
    }
  },
});
