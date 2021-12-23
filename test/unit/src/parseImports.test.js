import {assertEquals} from "https://deno.land/std@0.100.0/testing/asserts.ts";
import {parseImports} from "../../../src/parseImports.js";

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
		}
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
		}
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
		}
	]);
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
		}
	]);
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
