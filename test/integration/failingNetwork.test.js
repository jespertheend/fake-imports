import { assertRejects } from "asserts";
import { setupScriptTempDir } from "./shared.js";
import { Importer } from "../../mod.js";

Deno.test({
	name: "importing non existent file via file import",
	fn: async () => {
		const { cleanup, basePath } = await setupScriptTempDir({
			"main.js": `
        import "./does/not/exist.js";
      `,
		}, { prefix: "non_existent_file_via_file_test" });

		try {
			const importer = new Importer(basePath);
			await assertRejects(
				async () => {
					await importer.import("./main.js");
				},
				TypeError,
				`Failed to import "${basePath}does/not/exist.js" from "${basePath}main.js". A network error occurred while fetching the module.`,
			);
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "importing non existent file from more deeply nested parent file.",
	fn: async () => {
		const { cleanup, basePath } = await setupScriptTempDir({
			"path/to/main.js": `
        import "./does/not/exist.js";
      `,
		}, { prefix: "non_existent_file_via_file_test" });

		try {
			const importer = new Importer(basePath);
			await assertRejects(
				async () => {
					await importer.import("./path/to/main.js");
				},
				TypeError,
				`Failed to import "${basePath}path/to/does/not/exist.js" from "${basePath}path/to/main.js". A network error occurred while fetching the module.`,
			);
		} finally {
			await cleanup();
		}
	},
});

Deno.test({
	name: "importing non existent file via direct import",
	fn: async () => {
		const { cleanup, basePath } = await setupScriptTempDir({
			"main.js": `
        import "./does/not/exist.js";
      `,
		}, { prefix: "non_existent_file_via_direct_test" });

		try {
			const importer = new Importer(basePath);
			await assertRejects(
				async () => {
					await importer.import("./doesnotexist.js");
				},
				TypeError,
				`Failed to import "${basePath}doesnotexist.js". A network error occurred while fetching the module.`,
			);
		} finally {
			await cleanup();
		}
	},
});
