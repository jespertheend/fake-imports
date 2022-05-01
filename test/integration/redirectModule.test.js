import { assertEquals, assertRejects } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

async function simpleRedirectionDir() {
  return await setupScriptTempDir({
    "a.js": `export const value = "a";`,
    "b.js": `export const value = "b";`,
    "c.js": `export const value = "c";`,
    "main.js": `
      import {value} from "./a.js";
      export {value};
    `,
  });
}

Deno.test({
  name: "simple redirect from a.js to b.js",
  async fn() {
    const { cleanup, basePath } = await simpleRedirectionDir();

    try {
      const importer = new Importer(basePath);
      importer.redirectModule("./a.js", "./b.js");
      const main = await importer.import("./main.js");

      assertEquals(main.value, "b");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "URL Objects as arguments",
  fn: async () => {
    const { cleanup, basePath } = await simpleRedirectionDir();

    try {
      const importer = new Importer(basePath);
      const a = new URL("./a.js", basePath);
      const b = new URL("./b.js", basePath);
      importer.redirectModule(a, b);
      const main = await importer.import("./main.js");

      assertEquals(main.value, "b");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "redirect to a file that imports its neighbor",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "a.js": `export const value = "a";`,
      "subdir/b.js": `
        import {value} from "./neighbor.js";
        export {value};
      `,
      "subdir/neighbor.js": `export const value = "b";`,
      "main.js": `
        import {value} from "./a.js";
        export {value};
      `,
    });

    try {
      const importer = new Importer(basePath);
      importer.redirectModule("./a.js", "./subdir/b.js");
      const main = await importer.import("./main.js");

      assertEquals(main.value, "b");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "redirect to a file that imports a file from the parent directory",
  async fn() {
    const { cleanup, basePath } = await setupScriptTempDir({
      "a.js": `export const value = "a";`,
      "subdir/b.js": `
        import {value} from "../fileFromParentDir.js";
        export {value};
      `,
      "fileFromParentDir.js": `export const value = "b";`,
      "main.js": `
        import {value} from "./a.js";
        export {value};
      `,
    });

    try {
      const importer = new Importer(basePath);
      importer.redirectModule("./a.js", "./subdir/b.js");
      const main = await importer.import("./main.js");

      assertEquals(main.value, "b");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "redirect to a redirect",
  async fn() {
    const { cleanup, basePath } = await simpleRedirectionDir();

    try {
      const importer = new Importer(basePath);
      importer.redirectModule("./a.js", "./b.js");
      importer.redirectModule("./b.js", "./c.js");
      const main = await importer.import("./main.js");

      assertEquals(main.value, "c");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "importing a directly redrected file",
  async fn() {
    const { cleanup, basePath } = await simpleRedirectionDir();

    try {
      const importer = new Importer(basePath);
      importer.redirectModule("./a.js", "./b.js");
      const a = await importer.import("./a.js");

      assertEquals(a.value, "b");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "redirect to a non-existent file",
  async fn() {
    const { cleanup, basePath } = await simpleRedirectionDir();

    try {
      const importer = new Importer(basePath);
      importer.redirectModule("./a.js", "./does/not/exist.js");

      await assertRejects(
        async () => await importer.import("./main.js"),
        TypeError,
        `Failed to import "${basePath}does/not/exist.js" from "${basePath}main.js". A network error occurred while fetching the module.`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "circular redirect",
  async fn() {
    const { cleanup, basePath } = await simpleRedirectionDir();

    try {
      const importer = new Importer(basePath);
      importer.redirectModule("./a.js", "./b.js");
      importer.redirectModule("./b.js", "./a.js");

      await assertRejects(
        async () => await importer.import("./main.js"),
        Error,
        `Circular redirects detected.\n"${basePath}a.js" -> "${basePath}b.js" -> "${basePath}a.js"`,
      );
    } finally {
      await cleanup();
    }
  },
});
