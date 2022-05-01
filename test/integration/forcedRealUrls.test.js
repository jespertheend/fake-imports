import { assert, assertInstanceOf } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "Imports from a blob file when not set as real",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {Foo} from "./shouldBeBlob.js";

        const instance = new Foo();
        export {instance};
      `,
      "shouldBeBlob.js": `
        export class Foo {}
      `,
    }, { prefix: "not_forced_real_test" });

    try {
      const importer = new Importer(basePath);
      const { instance } = await importer.import("./main.js");
      const { Foo } = await import(new URL("./shouldBeBlob.js", basePath).href);

      assert(
        !(instance instanceof Foo),
        "instance should not be an instance of Foo",
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "Imports from the real file when set as real",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {Foo} from "./shouldBeReal.js";

        const instance = new Foo();
        export {instance};
      `,
      "shouldBeReal.js": `
        export class Foo {}
      `,
    }, { prefix: "forced_real_test" });

    try {
      const importer = new Importer(basePath);
      importer.makeReal("./shouldBeReal.js");
      const { instance } = await importer.import("./main.js");
      const { Foo } = await import(new URL("./shouldBeReal.js", basePath).href);

      assertInstanceOf(instance, Foo);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "making an import map resolved entry real",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {Foo} from "barespecifier";
        const instance = new Foo();
        export {instance};
      `,
      "notabarespecifier.js": `
        export class Foo {}
      `,
      "importmap.json": `
        {
          "imports": {
            "barespecifier": "./notabarespecifier.js"
          }
        }
      `,
    }, {
      prefix: "makereal_resolved_import_map_entry_test",
    });

    try {
      const importer = new Importer(basePath, {
        importMap: "./importmap.json",
      });
      importer.makeReal("./notabarespecifier.js");

      const { instance } = await importer.import("./main.js");
      const { Foo } = await import(
        new URL("./notabarespecifier.js", basePath).href
      );
      assertInstanceOf(instance, Foo);
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "making an import map bare specfier entry real",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "main.js": `
        import {Foo} from "barespecifier";
        const instance = new Foo();
        export {instance};
      `,
      "notabarespecifier.js": `
        export class Foo {}
      `,
      "importmap.json": `
        {
          "imports": {
            "barespecifier": "./notabarespecifier.js"
          }
        }
      `,
    }, {
      prefix: "makereal_bare_specifier_entry_test",
    });

    try {
      const importer = new Importer(basePath, {
        importMap: "./importmap.json",
      });
      importer.makeReal("barespecifier");

      const { instance } = await importer.import("./main.js");
      const { Foo } = await import(
        new URL("./notabarespecifier.js", basePath).href
      );
      assertInstanceOf(instance, Foo);
    } finally {
      await cleanup();
    }
  },
});
