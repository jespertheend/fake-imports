import { assertRejects } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "Basic circular import",
  permissions: {
    net: true,
  },
  fn: async () => {
    //    A  <-+
    //    |    |
    //    B    |
    //    |    |
    //    +----+

    const { cleanup, basePath } = await setupScriptTempDir({
      "A.js": `
        import {Bar} from "./B.js";
        export class A {}
      `,
      "B.js": `
        import {Foo} from "./A.js";
        export class B {}
      `,
    });

    const importer = new Importer(basePath);
    await assertRejects(
      async () => {
        await importer.import("./A.js");
      },
      Error,
      "Circular imports are not supported.",
    );

    await cleanup();
  },
});

Deno.test({
  name: "Circular import with multiple modules",
  permissions: {
    net: true,
  },
  fn: async () => {
    //    A  <-+
    //    |    |
    //    B    |
    //    |    |
    //    C    |
    //    |    |
    //    +----+

    const { cleanup, basePath } = await setupScriptTempDir({
      "A.js": `
        import {Bar} from "./B.js";
        export class A {}
      `,
      "B.js": `
        import {Foo} from "./scriptC.js";
        export class B {}
      `,
      "scriptC.js": `
        import {Foo} from "./A.js";
        export class ScriptC {}
      `,
    });

    const importer = new Importer(basePath);
    await assertRejects(
      async () => {
        await importer.import("./A.js");
      },
      Error,
      "Circular imports are not supported.",
    );

    await cleanup();
  },
});

Deno.test({
  name: "non-circular import that diverges and then joins again",
  permissions: {
    net: true,
  },
  fn: async () => {
    //      A
    //     / \
    //    B   C
    //   / \ / \
    //  D   E   F
    //     / \
    //    G   H

    const { cleanup, basePath } = await setupScriptTempDir({
      "A.js": `
        import "./B.js";
        import "./C.js";
      `,
      "B.js": `
        import "./D.js";
        import "./E.js";
      `,
      "C.js": `
        import "./E.js";
        import "./F.js";
      `,
      "D.js": "//empty",
      "E.js": `
        import "./G.js";
        import "./H.js";
      `,
      "F.js": "//empty",
      "G.js": "//empty",
      "H.js": "//empty",
    });

    const importer = new Importer(basePath);
    await importer.import("./A.js");

    await cleanup();
  },
});

Deno.test({
  name: "seemingly circular import but actually not",
  permissions: {
    net: true,
  },
  fn: async () => {
    //     A
    //    / \
    //   B   \
    //  / \   \
    // C   D   E
    //  \ /
    //   F     ^
    //   |     |
    //   +-----+

    const { cleanup, basePath } = await setupScriptTempDir({
      "A.js": `
        import "./B.js";
        import "./E.js";
      `,
      "B.js": `
        import "./C.js";
        import "./D.js";
      `,
      "C.js": `
        import "./F.js";
      `,
      "D.js": `
        import "./F.js";
      `,
      "F.js": `
        import "./E.js";
      `,
      "E.js": "//empty",
    });

    const importer = new Importer(basePath);
    await importer.import("./A.js");

    await cleanup();
  },
});

Deno.test({
  name: "circular import to diverging imports",
  ignore: true,
  permissions: {
    net: true,
  },
  fn: async () => {
    //   A
    //   |
    //   B
    //  / \
    // C   D  <-+
    //  \ /     |
    //   F      |
    //   |      |
    //   +------+

    const { cleanup, basePath } = await setupScriptTempDir({
      "A.js": `
        import "./B.js";
      `,
      "B.js": `
        import "./C.js";
        import "./D.js";
      `,
      "C.js": `
        import "./F.js";
      `,
      "D.js": `
        import "./F.js";
      `,
      "F.js": `
        import "./D.js";
      `,
    });

    const importer = new Importer(basePath);
    await assertRejects(
      async () => {
        await importer.import("./A.js");
      },
      Error,
      "Circular imports are not supported.",
    );

    await cleanup();
  },
});
