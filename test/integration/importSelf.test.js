import { assertEquals } from "asserts";
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
