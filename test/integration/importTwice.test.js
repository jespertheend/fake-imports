import { assertEquals } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
	name: "Import twice",
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
			const importer = new Importer(basePath);
			importer.fakeModule(
				"./replaced.js",
				`export const mutable = {changedBy: "fake"};`,
			);

			const firstModule = await importer.import("./main.js");
			firstModule.mutable.changedBy = "first import";
			const secondModule = await importer.import("./main.js");

			assertEquals(secondModule.mutable.changedBy, "first import");
		} finally {
			await cleanup();
		}
	},
});
