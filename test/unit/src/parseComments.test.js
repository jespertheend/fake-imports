import { assertEquals } from "asserts";
import { getCommentLocations } from "../../../src/parseComments.js";

Deno.test({
	name: "single line comment",
	fn() {
		const source = `// comment`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 0, end: 10 },
		]);
	},
});

Deno.test({
	name: "line comment after non comment",
	fn() {
		const source = `
			not a comment // comment
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 18, end: 28 },
		]);
	},
});

Deno.test({
	name: "line comment in between non comments",
	fn() {
		const source = `
			not a comment
			not a comment // comment
			not a comment
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 35, end: 45 },
		]);
	},
});

Deno.test({
	name: "multiple line comments",
	fn() {
		const source = `
			// comment
			not a comment
			not a comment // comment
			not a comment // comment
			not a comment
			not a comment // comment
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 4, end: 14 },
			{ start: 49, end: 59 },
			{ start: 77, end: 87 },
			{ start: 122, end: 132 },
		]);
	},
});

Deno.test({
	name: "block comment",
	fn() {
		const source = `/* comment */`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 0, end: 13 },
		]);
	},
});

Deno.test({
	name: "multi line block comment",
	fn() {
		const source = `
			/*
			comment
			*/
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 4, end: 23 },
		]);
	},
});

Deno.test({
	name: "jsdoc style comment",
	fn() {
		const source = `
			/**
			 * @fileoverview test
			 */
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 4, end: 39 },
		]);
	},
});

Deno.test({
	name: "line comment inside block comment",
	fn() {
		const source = `
			/*
			// comment
			*/
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 4, end: 26 },
		]);
	},
});

Deno.test({
	name: "block comment between non comments",
	fn() {
		const source = `
			not a comment
			/* comment */
			not a comment
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 21, end: 34 },
		]);
	},
});

Deno.test({
	name: "block comment inside line comment",
	fn() {
		const source = `
			// comment /* comment */
			not a comment
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 4, end: 28 },
		]);
	},
});

Deno.test({
	name: "non comment between two block comments",
	fn() {
		const source = `
			/* comment */
			not a comment
			/* comment */
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{ start: 4, end: 17 },
			{ start: 38, end: 51 },
		]);
	},
});

Deno.test({
	name: "line comment in a double quote string",
	fn() {
		const source = `
			"not a // comment"
		`;

		const result = getCommentLocations(source);

		assertEquals(result, []);
	},
});

Deno.test({
	name: "line comment in a single quote string",
	fn() {
		const source = `
			'not a // comment'
		`;

		const result = getCommentLocations(source);

		assertEquals(result, []);
	},
});

Deno.test({
	name: "line comment after a string",
	fn() {
		const source = `
			"str" // comment"
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{
				start: 10,
				end: 21,
			},
		]);
	},
});

Deno.test({
	name: "line comment after a double quote string with line comment",
	fn() {
		const source = `
			"not // a // comment" // comment
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{
				start: 26,
				end: 36,
			},
		]);
	},
});

Deno.test({
	name: "line comment after a single quote string with line comment",
	fn() {
		const source = `
			'not // a // comment' // comment
		`;

		const result = getCommentLocations(source);

		assertEquals(result, [
			{
				start: 26,
				end: 36,
			},
		]);
	},
});
