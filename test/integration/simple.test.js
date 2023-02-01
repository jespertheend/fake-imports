import { assert, assertEquals, assertInstanceOf, assertRejects } from "asserts";
import { setupScriptTempDir, simpleReplacementDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
	name: "Simple",
	fn: async () => {
		const { cleanup, basePath } = await simpleReplacementDir();

		try {
			const importer = new Importer(basePath);
			importer.fakeModule(
				"./replaced.js",
				`export const replaced = "replaced";`,
			);
			const main = await importer.import("./main.js");

			assertEquals(main.replaced, "replaced");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "fakeModule() with a URL object",
	async fn() {
		const { cleanup, basePath } = await simpleReplacementDir();

		try {
			const importer = new Importer(basePath);
			const url = new URL("./replaced.js", basePath);
			importer.fakeModule(url, `export const replaced = "replaced";`);
			const main = await importer.import("./main.js");

			assertEquals(main.replaced, "replaced");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "URL Object as argument",
	fn: async () => {
		const { cleanup, basePath } = await simpleReplacementDir();

		try {
			const basePathUrl = new URL(basePath);
			const importer = new Importer(basePathUrl);
			importer.fakeModule(
				"./replaced.js",
				`export const replaced = "replaced";`,
			);
			const main = await importer.import("./main.js");

			assertEquals(main.replaced, "replaced");
		} finally {
			await cleanup();
		}
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

		try {
			const importer = new Importer(basePath);
			importer.fakeModule(
				"./replaced.js",
				`export const replaced = "replaced";`,
			);
			const { a, b } = await importer.import("./main.js");

			assertEquals({ a, b }, { a: "replaced", b: "replaced" });
		} finally {
			await cleanup();
		}
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

		try {
			const importer = new Importer(basePath);
			const { foo } = await importer.import("./main.js");

			assertEquals(foo, "foo");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "Syntax errors during import have their blob urls replaced with the original urls",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"main.js": `
				export {foo} from "./foo.js";
			`,
			"foo.js": `
				export const foo = "foo;
			`,
		}, { prefix: "syntax_error_test" });

		try {
			const importer = new Importer(basePath);
			const fooUrl = new URL("./foo.js", basePath);
			/**
			 * @param {unknown} e
			 */
			const errorCb = (e) => {
				assertInstanceOf(e, TypeError);
				if (e.stack) {
					// If checkjs is enabled, (which it is when using deno task test),
					// the import will error with a type error from TypeScript rather
					// than a runtime error. If this is the case, blob urls are not
					// replaced, see https://github.com/denoland/deno/issues/14443
					if (!e.stack.includes("TS1002")) {
						assert(
							e.stack.includes(fooUrl.href),
							"Expected the stack trace to include the url to 'foo.js' at least once.",
						);
					}
				}
			};
			await assertRejects(
				async () => {
					await importer.import("./main.js");
				},
				errorCb,
			);
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "Runtime errors during import have their blob urls replaced with the original urls",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"main.js": `
				export {foo} from "./foo.js";
			`,
			"foo.js": `
				const foo = "foo";

				a();
				function a() {
				b();
				}

				function b() {
				c();
				}

				function c() {
				// @ts-ignore
				foo.nonExistentFunction();
				}
				export {foo};
			`,
		}, { prefix: "syntax_error_test" });

		try {
			const importer = new Importer(basePath);
			const fooUrl = new URL("./foo.js", basePath);
			/**
			 * @param {unknown} e
			 */
			const errorCb = (e) => {
				assertInstanceOf(e, TypeError);
				if (e.stack) {
					assertEquals(
						e.stack,
						`TypeError: foo.nonExistentFunction is not a function
    at c (${fooUrl}:15:9)
    at b (${fooUrl}:10:5)
    at a (${fooUrl}:6:5)
    at ${fooUrl}:4:5`,
					);
				}
			};
			await assertRejects(async () => {
				await importer.import("./main.js");
			}, errorCb);
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "Importing a typescript file from a javascript file",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"main.js": `
				import {getTypedFunction} from "./typescriptFile.ts";
				const result = getTypedFunction("foo");
				export {result};
			`,
			"typescriptFile.ts": `
				export function getTypedFunction(x: string) : string {
				return x;
				}
			`,
		}, { prefix: "typescript_imports_test" });

		try {
			const importer = new Importer(basePath);
			const main = await importer.import("./main.js");

			assertEquals(main.result, "foo");
		} finally {
			await cleanup();
		}
	},
});
