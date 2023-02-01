import { assertEquals } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
	name: "Multiple Importer instances",
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
			prefix: "import_twice_test",
		});

		try {
			const fakeReplacedSource = `export const mutable = {changedBy: "fake"};`;

			const importer1 = new Importer(basePath);
			importer1.fakeModule("./replaced.js", fakeReplacedSource);
			const importer2 = new Importer(basePath);
			importer2.fakeModule("./replaced.js", fakeReplacedSource);

			const firstModule = await importer1.import("./main.js");
			firstModule.mutable.changedBy = "first import";
			const secondModule = await importer2.import("./main.js");

			assertEquals(secondModule.mutable.changedBy, "fake");
		} finally {
			await cleanup();
		}
	},
});
