import { assertRejects } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
  name: "Basic circular import",
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

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("./A.js");
        },
        Error,
        `Circular imports are not supported:
A.js -> B.js -> A.js
Consider passing one of the following paths to \`importer.makeReal()\`:
./A.js
./B.js`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "Circular import with multiple modules",
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
        import {Foo} from "./C.js";
        export class B {}
      `,
      "C.js": `
        import {Foo} from "./A.js";
        export class ScriptC {}
      `,
    });

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("./A.js");
        },
        Error,
        `Circular imports are not supported:
A.js -> B.js -> C.js -> A.js
Consider passing one of the following paths to \`importer.makeReal()\`:
./A.js
./B.js
./C.js`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "Circular import to a non root module",
  fn: async () => {
    //    A
    //    |
    //    B  <-+
    //    |    |
    //    C    |
    //    |    |
    //    D----+

    const { cleanup, basePath } = await setupScriptTempDir({
      "A.js": `
        import {Bar} from "./B.js";
        export class A {}
      `,
      "B.js": `
        import {Foo} from "./C.js";
        export class B {}
      `,
      "C.js": `
        import {Foo} from "./D.js";
        export class ScriptC {}
      `,
      "D.js": `
        import {Foo} from "./B.js";
        export class ScriptC {}
      `,
    });

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("./A.js");
        },
        Error,
        `Circular imports are not supported:
A.js -> B.js -> C.js -> D.js -> B.js
Consider passing one of the following paths to \`importer.makeReal()\`:
./A.js
./B.js
./C.js
./D.js`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "circular import with import from parent directory",
  fn: async () => {
    //  root/A  <-------+
    //    |             |
    //  root/scripts/B  |
    //    |             |
    //  root/C          |
    //    |             |
    //    +-------------+

    const { cleanup, basePath } = await setupScriptTempDir({
      "root/A.js": `
        import {Bar} from "./scripts/B.js";
        export class A {}
      `,
      "root/scripts/B.js": `
        import {Foo} from "../C.js";
        export class B {}
      `,
      "root/C.js": `
        import {Foo} from "./A.js";
        export class ScriptC {}
      `,
    });

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("./root/A.js");
        },
        Error,
        `Circular imports are not supported:
A.js -> B.js -> C.js -> A.js
Consider passing one of the following paths to \`importer.makeReal()\`:
./root/A.js
./root/scripts/B.js
./root/C.js`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "non-circular import that diverges and then joins again",
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

    try {
      const importer = new Importer(basePath);
      await importer.import("./A.js");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "seemingly circular import but actually not",
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

    try {
      const importer = new Importer(basePath);
      await importer.import("./A.js");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "circular import to diverging imports",
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

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("./A.js");
        },
        Error,
        `Circular imports are not supported:
A.js -> B.js -> D.js -> F.js -> D.js
Consider passing one of the following paths to \`importer.makeReal()\`:
./A.js
./B.js
./D.js
./F.js`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "file that imports itself",
  fn: async () => {
    //   +----+
    //   |    |
    //   v    |
    //        |
    //   A    |
    //   |    |
    //   +----+

    const { cleanup, basePath } = await setupScriptTempDir({
      "A.js": `
        import "./A.js";
      `,
    });

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("./A.js");
        },
        Error,
        `Circular imports are not supported. "${basePath}A.js" imports itself.
Consider passing the following path to \`importer.makeReal()\`:
./A.js`,
      );
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "circular import with file above the base path",
  async fn() {
    //    A  <-+
    //    |    |
    //    B    |
    //    |    |
    //    +----+

    const { cleanup, basePath: tmpDirBasePath } = await setupScriptTempDir({
      "A/A.js": `
        import {B} from "../B/B.js";
        export class A {}
      `,
      "B/B.js": `
        import {A} from "../A/A.js";
        export class B {}
      `,
    });

    const basePath = tmpDirBasePath + "A/";

    try {
      const importer = new Importer(basePath);
      await assertRejects(
        async () => {
          await importer.import("./A.js");
        },
        Error,
        `Circular imports are not supported:
A.js -> B.js -> A.js
Consider passing one of the following paths to \`importer.makeReal()\`:
./A.js
../B/B.js`,
      );
    } finally {
      await cleanup();
    }
  },
});
