import { assertEquals } from "asserts";
import { parseImports } from "../../../src/parseImports.js";

Deno.test({
  name: "No imports",
  fn() {
    const script = `
      //empty script
    `;

    const imports = parseImports(script);

    assertEquals(imports, []);
  },
});

Deno.test("Single quote", () => {
  const script = `
		import './script.js';
	`;

  const imports = parseImports(script);

  assertEquals(imports, [
    {
      start: 11,
      length: 11,
      url: "./script.js",
    },
  ]);
});

Deno.test("Double quote", () => {
  const script = `
		import "./script.js";
	`;

  const imports = parseImports(script);

  assertEquals(imports, [
    {
      start: 11,
      length: 11,
      url: "./script.js",
    },
  ]);
});

Deno.test("Multiple", () => {
  const script = `
		import "./script.js";
		import './script.js';
	`;

  const imports = parseImports(script);

  assertEquals(imports, [
    {
      start: 11,
      length: 11,
      url: "./script.js",
    },
    {
      start: 35,
      length: 11,
      url: "./script.js",
    },
  ]);
});

Deno.test({
  name: "Multiple on a single line",
  fn() {
    const script = `
      import "./scriptA.js"; import './scriptB.js';
    `;

    const imports = parseImports(script);

    assertEquals(imports, [
      {
        start: 15,
        length: 12,
        url: "./scriptA.js",
      },
      {
        start: 38,
        length: 12,
        url: "./scriptB.js",
      },
    ]);
  },
});

Deno.test("With line break", () => {
  const script = `
		import {named} from
		"./script.js";
	`;

  const imports = parseImports(script);

  assertEquals(imports, [
    {
      start: 26,
      length: 11,
      url: "./script.js",
    },
  ]);
});

Deno.test("Dynamic", () => {
  const script = `
		import {staticImport} from "./script.js";

		(async () => {
			const module = await import("./script.js");
		})();
	`;

  const imports = parseImports(script);

  assertEquals(imports, [
    {
      start: 31,
      length: 11,
      url: "./script.js",
    },
    {
      start: 95,
      length: 11,
      url: "./script.js",
    },
  ]);
});

Deno.test({
  name: "Doesn't import inside comments",
  fn() {
    const scriptSources = [
      `
		// import './script.js';
	  `,
      `
		// import "./script.js";
	  `,
      `
		// import {named} from "./script.js";
	  `,
      `
		/* import './script.js'; */
	  `,
      `
		/*
		 * import "./script.js";
		 */
	  `,
      `
    // import("./script.js")
    `,
      `
    // ;import "./script.js"
    `,
      `
    /*
    import "./script.js";
    */
    `,
      `
    /*
    import("./script.js")
    */
    `,
      `
    /*
     * import("./script.js")
    */
    `,
    ];

    for (const source of scriptSources) {
      const imports = parseImports(source);

      assertEquals(
        imports,
        [],
        `The following should not have imports: ${source}`,
      );
    }
  },
});
