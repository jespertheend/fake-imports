import { assertEquals } from "asserts";
import { mapIndex } from "../../../src/mapDiffOffsetsIndex.js";

Deno.test({
	name: "Unchanged",
	fn: () => {
		const mappedIndex = mapIndex(10, [[0, 0]]);

		assertEquals(mappedIndex, 10);
	},
});

Deno.test({
	name: "Single offset",
	fn: () => {
		const mappedIndex = mapIndex(10, [[0, 5]]);

		assertEquals(mappedIndex, 15);
	},
});

Deno.test({
	name: "Negative offset",
	fn: () => {
		const mappedIndex = mapIndex(10, [[0, -5]]);

		assertEquals(mappedIndex, 5);
	},
});

Deno.test({
	name: "Two offsets",
	fn: () => {
		/** @type {import("../../../src/computeDiffOffsets.js").DiffOffsets} */
		const offsets = [
			[0, 1],
			[10, 2],
		];

		const mappedIndex1 = mapIndex(5, offsets);
		const mappedIndex2 = mapIndex(15, offsets);

		assertEquals(mappedIndex1, 6); // 5 + 1
		assertEquals(mappedIndex2, 17); // 15 + 2
	},
});

Deno.test({
	name: "Null offset at the start",
	fn: () => {
		/** @type {import("../../../src/computeDiffOffsets.js").DiffOffsets} */
		const offsets = [
			[0, null],
			[10, -10],
		];

		const mappedIndex1 = mapIndex(5, offsets);
		const mappedIndex2 = mapIndex(15, offsets);

		assertEquals(mappedIndex1, 0); // Shifted towards the next range minus its offset: 10 - 10
		assertEquals(mappedIndex2, 5); // 15 - 10
	},
});

Deno.test({
	name: "Null offset in the middle",
	fn: () => {
		/** @type {import("../../../src/computeDiffOffsets.js").DiffOffsets} */
		const offsets = [
			[0, 0],
			[10, null],
			[20, -10],
		];

		const mappedIndex1 = mapIndex(15, offsets);
		const mappedIndex2 = mapIndex(25, offsets);

		assertEquals(mappedIndex1, 10); // Shifted towards the previous range minus its offset: 10 - 0
		assertEquals(mappedIndex2, 15); // 25 - 10
	},
});

Deno.test({
	name: "Null offset at the end",
	fn: () => {
		/** @type {import("../../../src/computeDiffOffsets.js").DiffOffsets} */
		const offsets = [
			[0, 0],
			[10, null],
		];

		const mappedIndex1 = mapIndex(5, offsets);
		const mappedIndex2 = mapIndex(15, offsets);

		assertEquals(mappedIndex1, 5); // 5 - 0
		assertEquals(mappedIndex2, 10); // Shifted towards the previous range minus its offset: 10 - 0
	},
});
