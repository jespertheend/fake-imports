import { assertEquals } from "asserts";
import { parseImports } from "../../../src/parseImports.js";

Deno.test({
	name: "No imports",
	fn() {
		const script = `
			//empty script
		`;

		const imports = parseImports(script);

		assertEquals(imports, []);
	},
});

Deno.test("Single quote", () => {
	const script = `
		import './script.js';
	`;

	const imports = parseImports(script);

	assertEquals(imports, [
		{
			start: 11,
			length: 11,
			url: "./script.js",
		},
	]);
});

Deno.test("Double quote", () => {
	const script = `
		import "./script.js";
	`;

	const imports = parseImports(script);

	assertEquals(imports, [
		{
			start: 11,
			length: 11,
			url: "./script.js",
		},
	]);
});

Deno.test("Multiple", () => {
	const script = `
		import "./script.js";
		import './script.js';
	`;

	const imports = parseImports(script);

	assertEquals(imports, [
		{
			start: 11,
			length: 11,
			url: "./script.js",
		},
		{
			start: 35,
			length: 11,
			url: "./script.js",
		},
	]);
});

Deno.test({
	name: "Multiple on a single line",
	fn() {
		const script = `
			import "./scriptA.js"; import './scriptB.js';
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 12,
				length: 12,
				url: "./scriptA.js",
			},
			{
				start: 35,
				length: 12,
				url: "./scriptB.js",
			},
		]);
	},
});

Deno.test("With line break", () => {
	const script = `
		import {named} from
		"./script.js";
	`;

	const imports = parseImports(script);

	assertEquals(imports, [
		{
			start: 26,
			length: 11,
			url: "./script.js",
		},
	]);
});

Deno.test({
	name: "import * from",
	fn() {
		const script = `
			import * from "./script.js";
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 19,
				length: 11,
				url: "./script.js",
			},
		]);
	},
});

Deno.test({
	name: "wildcard with 'as'",
	fn() {
		const script = `
			import * as foo from "./script.js";
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 26,
				length: 11,
				url: "./script.js",
			},
		]);
	},
});

Deno.test({
	name: "export {named} from",
	fn() {
		const script = `
			export {named} from "./script.js";
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 25,
				length: 11,
				url: "./script.js",
			},
		]);
	},
});

Deno.test({
	name: "export * from",
	fn() {
		const script = `
			export * from "./script.js";
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 19,
				length: 11,
				url: "./script.js",
			},
		]);
	},
});

Deno.test({
	name: "export * as named from",
	fn() {
		const script = `
			export * as foo from "./script.js";
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 26,
				length: 11,
				url: "./script.js",
			},
		]);
	},
});

Deno.test({
	name: "export {named1 as named2} from",
	fn() {
		const script = `
			export {named1 as named2} from "./script.js";
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 36,
				length: 11,
				url: "./script.js",
			},
		]);
	},
});

Deno.test({
	name: "export {default, name1} from",
	fn() {
		const script = `
			export {default, name1} from "./script.js";
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 34,
				length: 11,
				url: "./script.js",
			},
		]);
	},
});

Deno.test("Dynamic", () => {
	const script = `
		import {staticImport} from "./script.js";

		(async () => {
			const module = await import("./script.js");
		})();
	`;

	const imports = parseImports(script);

	assertEquals(imports, [
		{
			start: 31,
			length: 11,
			url: "./script.js",
		},
		{
			start: 95,
			length: 11,
			url: "./script.js",
		},
	]);
});

Deno.test({
	name: "full url",
	fn() {
		const script = `
			import {foo} from "https://example.com/mapped.js";
		`;

		const imports = parseImports(script);

		assertEquals(imports, [
			{
				start: 23,
				length: 29,
				url: "https://example.com/mapped.js",
			},
		]);
	},
});

Deno.test({
	name: "Doesn't import inside comments",
	fn() {
		const scriptSources = [
			`
				// import './script.js';
			`,
			`
				// import "./script.js";
			`,
			`
				// import {named} from "./script.js";
			`,
			`
				/* import './script.js'; */
			`,
			`
				/*
				* import "./script.js";
				*/
			`,
			`
				// import("./script.js")
			`,
			`
				// ;import "./script.js"
			`,
			`
				/*
				import "./script.js";
				*/
			`,
			`
				/*
				import("./script.js")
				*/
			`,
			`
				/*
				* import("./script.js")
				*/
			`,
		];

		for (const source of scriptSources) {
			const imports = parseImports(source);

			assertEquals(
				imports,
				[],
				`The following should not have imports: ${source}`,
			);
		}
	},
});

Deno.test({
	name: "Import wrapped in between two block comments.",
	fn() {
		const scriptSource = `
/** comment. */
import {foo} from "./script.js";
/** other comment. */
		`;

		const result = parseImports(scriptSource);

		assertEquals(result, [
			{
				start: 36,
				length: 11,
				url: "./script.js",
			},
		]);
	},
});

Deno.test({
	name: "Doesn't import declared variables",
	fn() {
		const scriptSources = [
			`
				export const foo = "foo";
			`,
			`
				export function foo() { return "foo" };
			`,
			`
				export default function foo() { return "foo" };
			`,
			`
				export class Foo {
					constructor() {
						this.x = "foo";
					}
				}
			`,
		];

		for (const source of scriptSources) {
			const imports = parseImports(source);

			assertEquals(
				imports,
				[],
				`The following should not have imports: ${source}`,
			);
		}
	},
});

Deno.test({
	name: "'from' inside a string",
	fn() {
		const src = `
			export function foo() {
				const x = 'test from "yes" ';
			}
		`;

		const imports = parseImports(src);

		assertEquals(imports, []);
	},
});
