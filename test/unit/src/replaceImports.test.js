import { assertEquals } from "asserts";
import { replaceImports } from "../../../src/replaceImports.js";

Deno.test("Basic replace", () => {
  const scriptSource = `
		import "./initial.js";
	`;

  const replacedScriptSource = replaceImports([
    {
      start: 11,
      length: 12,
      url: "./initial.js",
    },
  ], [
    "./replaced.js",
  ], scriptSource);

  assertEquals(
    replacedScriptSource,
    `
		import "./replaced.js";
	`,
  );
});

Deno.test("Replace multiple", () => {
  const scriptSource = `
		import "./initial1.js";
		import "./initial2.js";
	`;

  const replacedScriptSource = replaceImports([
    {
      start: 11,
      length: 13,
      url: "./initial1.js",
    },
    {
      start: 37,
      length: 13,
      url: "./initial2.js",
    },
  ], [
    "./replaced1.js",
    "./replaced2.js",
  ], scriptSource);

  assertEquals(
    replacedScriptSource,
    `
		import "./replaced1.js";
		import "./replaced2.js";
	`,
  );
});

Deno.test("Replace nothing", () => {
  const scriptSource = `
		// no imports
	`;

  const replacedScriptSource = replaceImports([], [], scriptSource);

  assertEquals(replacedScriptSource, scriptSource);
});
