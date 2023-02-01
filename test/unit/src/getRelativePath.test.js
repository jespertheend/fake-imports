import { assertEquals } from "asserts";
import { getRelativePath } from "../../../src/getRelativePath.js";

Deno.test({
	name: "basic paths",
	fn() {
		const result = getRelativePath(
			"file:///path/to/",
			"file:///path/to/b.js",
		);
		assertEquals(result, "./b.js");
	},
});

Deno.test({
	name: "travelling up",
	fn() {
		const result = getRelativePath(
			"file:///path/to/dir/with/extra/",
			"file:///path/to/b.js",
		);
		assertEquals(result, "../../../b.js");
	},
});
