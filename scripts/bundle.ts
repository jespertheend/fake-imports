/**
 * @fileoverview Bundles fake-imports into a single file that can be run in the browser.
 */

import { bundle } from "https://deno.land/x/emit@0.31.1/mod.ts";
import { minify } from "npm:terser@5.15.0";
import * as path from "$std/path/mod.ts";
import * as fs from "$std/fs/mod.ts";
import { setCwd } from "$chdir_anywhere";
setCwd();
Deno.chdir("..");

const { code: bundled } = await bundle(new URL("../mod.js", import.meta.url));

const { code: minified } = await minify(bundled);

if (!minified) {
	throw new Error("Failed to minify");
}

try {
	await Deno.remove("dist", { recursive: true });
} catch (e) {
	if (e instanceof Deno.errors.NotFound) {
		// Already removed
	} else {
		throw e;
	}
}
await fs.ensureDir("dist");

await Deno.writeTextFile("dist/fake_imports.js", minified);
await Deno.writeTextFile("dist/fake_imports.d.ts", 'export * from "./dts/mod.dts";');

const tmpDtsDir = path.resolve("dist/tmpDts");
await fs.ensureDir(tmpDtsDir);

// Generate fake_imports.d.ts
const command = new Deno.Command(Deno.execPath(), {
	args: [
		"run",
		"--allow-env",
		"--allow-read",
		"--allow-write",
		"--node-modules-dir=false",
		"npm:typescript@5.0.2/tsc",
		"-p",
		"./generateTypes.tsconfig.json",
		"--outDir",
		tmpDtsDir,
	],

	stderr: "piped",
	stdout: "piped",
});
const { stderr: _stderr, stdout: _stdout } = await command.output();

// tsc emits a whooole bunch of type errors that we are just going to ignore
// because deno test already does type checking for us.
// The code below can be uncommented when debugging issues:

// console.log(new TextDecoder().decode(_stdout));
// console.error(new TextDecoder().decode(_stderr));

const dtsSrcDir = path.resolve(tmpDtsDir, "src");
const dtsDir = path.resolve("dist/dts");
await Deno.rename(dtsSrcDir, dtsDir);
await Deno.rename(path.resolve(tmpDtsDir, "mod.d.ts"), "dist/fake_imports.d.ts");
await Deno.remove(tmpDtsDir);
