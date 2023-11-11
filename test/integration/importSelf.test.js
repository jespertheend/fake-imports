import { assert, assertEquals } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
	name: "fakeModule() that imports itself",
	fn: async () => {
		const { cleanup, basePath } = await setupScriptTempDir({
			"main.js": `
				import {mutable} from "./replaced.js";
				export {mutable};
			`,
			"replaced.js": `
				export const mutable = {changedBy: "not changed"};
			`,
		}, {
			prefix: "fakeModule_import_self_test",
		});

		try {
			const importer = new Importer(basePath);
			importer.fakeModule(
				"./replaced.js",
				`
					import {mutable} from "./replaced.js";
					mutable.changedBy = "fake";
					export {mutable};
			`,
			);

			const main = await importer.import("./main.js");
			assertEquals(main.mutable.changedBy, "fake");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "redirectModule() that imports itself",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"main.js": `
				import {mutable} from "./real.js";
				export {mutable};
			`,
			"real.js": `
				export const mutable = {changedBy: "not changed"};
			`,
			"fake.js": `
				import {mutable} from "./real.js";
				mutable.changedBy = "fake";
				export {mutable};
			`,
		}, {
			prefix: "redirectModule_import_self_test",
		});

		try {
			const importer = new Importer(basePath);
			importer.redirectModule("./real.js", "./fake.js");

			const main = await importer.import("./main.js");
			assertEquals(main.mutable.changedBy, "fake");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "when a module imports itself, it is still faked",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"Foo.js": `
				export class Foo {}
			`,
		}, {
			prefix: "fakeModule_still_faked_import_self_test",
		});

		try {
			const importer = new Importer(basePath);
			importer.fakeModule(
				"./Foo.js",
				`
					import {Foo} from "./Foo.js";
					export {Foo};
			`,
			);

			const { Foo: RealFoo } = await import(basePath + "Foo.js");
			const mod = await importer.import("./Foo.js");
			const fooInstance = new mod.Foo();
			assert(!(fooInstance instanceof RealFoo), "Expected fooInstance to not be an instance of the real Foo.");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "redirectModule() that imports itself is still faked",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"Foo.js": `
				export class Foo {}
			`,
			"FakeFoo.js": `
				import {Foo} from "./Foo.js";
				export {Foo};
			`,
		}, {
			prefix: "redirectModule_still_faked_import_self_test",
		});

		try {
			const importer = new Importer(basePath);
			importer.redirectModule("./Foo.js", "./FakeFoo.js");

			const { Foo: RealFoo } = await import(basePath + "Foo.js");
			const mod = await importer.import("./Foo.js");
			const fooInstance = new mod.Foo();
			assert(!(fooInstance instanceof RealFoo), "Expected fooInstance to not be an instance of the real Foo.");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "marking self imported module as real",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"Foo.js": `
				export class Foo {}
			`,
		}, {
			prefix: "fakeModule_still_faked_import_self_test",
		});

		try {
			const importer = new Importer(basePath);
			importer.fakeModule(
				"./Foo.js",
				`
					import {Foo} from "./Foo.js";
					export {Foo};
					export const extra = true;
			`,
			);
			importer.makeReal("./Foo.js");

			const { Foo: RealFoo } = await import(basePath + "Foo.js");
			const mod = await importer.import("./Foo.js");
			const fooInstance = new mod.Foo();
			assertEquals(mod.extra, true);
			assert(fooInstance instanceof RealFoo, "Expected fooInstance to be an instance of the real Foo.");
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "marking a redirectModule() that imports itself as real",
	async fn() {
		const { cleanup, basePath } = await setupScriptTempDir({
			"Foo.js": `
				export class Foo {}
			`,
			"FakeFoo.js": `
				import {Foo} from "./Foo.js";
				export {Foo};
				export const extra = true;
			`,
		}, {
			prefix: "redirectModule_still_faked_import_self_test",
		});

		try {
			const importer = new Importer(basePath);
			importer.redirectModule("./Foo.js", "./FakeFoo.js");
			importer.makeReal("./Foo.js");

			const { Foo: RealFoo } = await import(basePath + "Foo.js");
			const mod = await importer.import("./Foo.js");
			const fooInstance = new mod.Foo();
			assertEquals(mod.extra, true);
			assert(fooInstance instanceof RealFoo, "Expected fooInstance to be an instance of the real Foo.");
		} finally {
			await cleanup();
		}
	},
});
