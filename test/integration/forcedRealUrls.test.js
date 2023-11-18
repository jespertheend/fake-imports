import { assert, assertEquals, assertInstanceOf, assertNotStrictEquals, assertRejects } from "asserts";
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
	name: "Making an invalid specifier real doesn't cause other imports to fail",
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
			importer.makeReal("invalidEntry", { exactMatch: true });
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
				makeImportMapEntriesReal: false,
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
				makeImportMapEntriesReal: false,
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

Deno.test({
	name: "making an import map bare specfier entry real with exactMatch true",
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
			prefix: "makereal_bare_specifier_entry_with_useunresolved_test",
		});

		try {
			const importer = new Importer(basePath, {
				importMap: "./importmap.json",
			});
			importer.makeReal("barespecifier", { exactMatch: true });

			// We expect the import to reject because our test suite doesn't have the
			// same import map set as used for the `new Importer` above.
			await assertRejects(
				async () => {
					await importer.import("./main.js");
				},
				TypeError,
				`Relative import path "barespecifier" not prefixed with`,
			);
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "making a bare specfier real with exactMatch true without an entry in the import map",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"main.js": `
				import { assert } from "asserts";
				assert(true);
			`,
		}, {
			prefix: "makereal_bare_specifier_entry_with_exactmatch_test",
		});

		try {
			const importer = new Importer(basePath);
			importer.makeReal("asserts", { exactMatch: true });

			// We don't expect the import to reject because our test suite does have "asserts" in the import map.
			// Even though the `Importer` doesn't know about the import map,
			// the fact that it has been marked as real causes the `Importer` to ignore it.
			await importer.import("./main.js");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "making real with exactMatch true only affects specifiers that match exactly",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"foo.js": `
				export const foo = Symbol("foo");
			`,
			"subdir/notReal.js": `
				export * from "../foo.js";
			`,
			"real.js": `
				export * from "./foo.js";
			`,
		}, {
			prefix: "makereal_bare_specifier_entry_with_exactmatch_test",
		});

		try {
			const importer = new Importer(basePath);
			importer.makeReal("./foo.js", { exactMatch: true });

			const realFooMod = await import(basePath + "foo.js");

			const notRealReexport = await importer.import("./subdir/notReal.js");
			assertNotStrictEquals(notRealReexport.foo, realFooMod.foo, "Expected notReal.js to not load the real module.");

			await assertRejects(async () => {
				// We expect the following to reject because "./foo.js" matches exactly and thus was marked as real.
				// However, since it was an exact match, the Importer doesn't resolve the specifier to the absolute
				// path of `foo.js`. But "real.js" has been replaced by a blob url, and as a result "./foo.js"
				// is attempted to be imported from that blob url.
				// This isn't possible, causing JavaScript (in our case Deno) to throw an error while making the
				// dynamic import() call.
				await importer.import("./real.js");
			});
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "faking a module that was marked as real should still work",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"foo.js": `
				export const foo = {
					real: true,
				}
			`,
			"parent.js": `
				import {foo} from "./foo.js";
				export const real = foo.real;
			`,
		});

		try {
			const importer = new Importer(basePath);
			importer.fakeModule(
				"./foo.js",
				`
					export const foo = {
						real: false,
					}
				`,
			);
			importer.makeReal("./foo.js");

			const mod = await importer.import("./parent.js");
			assertEquals(mod.real, false);
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "marking a redirected module as real",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"Foo.js": `
				export class Foo {}
			`,
			"RedirectedFoo.js": `
				export class Foo {}
			`,
			"main.js": `
				import {Foo} from "./Foo.js";
				export const instance = new Foo();
			`,
		});

		try {
			const importer = new Importer(basePath);
			importer.redirectModule("./Foo.js", "./RedirectedFoo.js");
			importer.makeReal("./RedirectedFoo.js");

			const mod = await importer.import("./main.js");

			const { Foo: FakeFoo } = await importer.import("./Foo.js");
			assert(mod.instance instanceof FakeFoo, "Expected to be an instance of the fake Foo.");

			const { Foo: RealFoo } = await import(basePath + "Foo.js");
			const { Foo: RedirectedFoo } = await import(basePath + "RedirectedFoo.js");
			assert(!(mod.instance instanceof RealFoo), "Expected not to be an instance of the real Foo.");
			assert(mod.instance instanceof RedirectedFoo, "Expected to be an instance of the redirected Foo.");
		} finally {
			await cleanup();
		}
	},
});
