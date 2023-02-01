# Fake Imports

[![Github ci](https://github.com/jespertheend/fake-imports/actions/workflows/ci.yml/badge.svg)](https://github.com/jespertheend/fake-imports/actions/workflows/ci.yml)
[![Deno version](https://shields.io/github/v/release/jespertheend/fake-imports?label=Deno.land/x&logo=deno&include_prereleases)](https://deno.land/x/fake_imports) [![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/fake_imports/mod.js/~/Importer)
[![license](https://img.shields.io/github/license/jespertheend/fake-imports)](https://github.com/jespertheend/fake-imports/blob/master/LICENSE)

This is a small module for Deno and browser environments that can be used for blocking specific imports using the esm `import` syntax. It is mostly meant for Stubbing and Mocking modules in unit tests, but can be used for other purposes as well.

Take the following two files for example:

```js
// module_with_side_effects.js
const div = document.createElement("div");

export function getDiv() {
	return div;
}
```

```js
// foo.js
import { getDiv } from "./module_with_side_effects.js";

export class Foo {
	x = 1;
	div = null;

	getX() {
		return this.x;
	}

	setupElement() {
		this.div = createDiv();
	}
}
```

Let's say we want to write a unit test for the `getX()` method:

```js
// foo.test.js
import { Foo } from "./foo.js";
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

Deno.test("getX", () => {
	const foo = new Foo();
	const x = foo.getX();
	assertEquals(x, 1);
});
```

In theory this should work, because in our test the div isn't used. But if we run `deno test` we get:

```
error: Uncaught ReferenceError: document is not defined
const div = document.createElement("div");
            ^
```

Because `module_with_side_effects.js` has side effects, the div is created the moment the module is imported. Ideally a problem like this would prompt you to rewrite your code so that no modules have any side effects, but this isn't always feasible.

This module was created to solve this problem. By allowing you to overwrite the code of an imported file, you can change its behaviour, or prevent it from doing anything at all.

## Usage

Let's take our previous test as an example. Rather than importing `"./foo.js"` directly, we'll create a `new Importer()` and load `"./foo.js"` dynamically inside the test itself:

```js
import { Importer } from "https://deno.land/x/fake_imports/mod.js";
const importer = new Importer(import.meta.url);

Deno.test("getX", async () => {
	const { Foo } = await importer.import("./foo.js");
});
```

Now we'll replace the content of `"./module_with_side_effects.js"` so that it has no side effects:

```js
importer.fakeModule(
	"./module_with_side_effects.js",
	"export function getDiv() {}",
);
```

And then just continue running your test like usual. Be sure to run it with `--allow-read` and `--allow-net`. Here's what that the full file looks like:

```js
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Importer } from "https://deno.land/x/fake_imports/mod.js";
const importer = new Importer(import.meta.url);

importer.fakeModule(
	"./module_with_side_effects.js",
	"export function getDiv() {}",
);

Deno.test("getX", async () => {
	const { Foo } = await importer.import("./foo.js");

	const foo = new Foo();
	const x = foo.getX();
	assertEquals(x, 1);
});
```

For more complex cases, it is also possible for faked modules to import themselves.

```js
const importer = new Importer(import.meta.url);
importer.fakeModule(
	"./original.js",
	`
  import {someObject} from "./original.js";
  // Modify someObject here
  export {someObject};
`,
);
```

You can also pass in a function, if you want complete controll over what gets modified:

```js
const importer = new Importer(import.meta.url);
importer.fakeModule("./original.js", (original) => {
	return original.fullContent.replace("foo", "bar");
});
```

## Excluding imports

Internally, a blob url is created for every imported (sub)module, more about that in [How it works internally](#how-it-works-internally). But this means that if you are importing a lot of (sub)modules, this could potentially be a very slow operation.

To work around this issue, it is possible to mark specific imports as real. This means that if the provided module is imported from anywhere, it won't be replaced with a blob url.

You can mark modules as real like so:

```js
const importer = new Importer(import.meta.url);
importer.makeReal("./Foo.js");
```

Like this, if any module imports `Foo.js`, it won't be replaced by blob urls. And as a result, any modules imported by `Foo.js` won't be replaced either.

Another benefit of this, is that classes imported using both `await importer.import()` and actual `import` syntax are exactly the same. So if you want to use `instanceof` on an object imported using fake imports, this is still possible.

## Import maps

If you are using import maps, you have to let the importer know about them in order for modules to resolve correctly. This can be done with `importMap` option:

```js
const importer = new Importer(import.meta.url, {
	importMap: "./path/to/importMap.json",
});
```

You can provide a path to an import map, or provide an import map directly:

```js
const importer = new Importer(import.meta.url, {
	importMap: {
		imports: {
			"lib": "./path/to/libary.js",
		},
	},
});
```

Import maps are assumed to be used for large libraries and generally things that don't need to be faked. So by default, all entries from the provided import map are [marked as real](#excluding-imports). If you don't want this to happen you can set `makeImportMapEntriesReal` to false:

```js
const importer = new Importer(import.meta.url, {
	importMap: "./path/to/importMap.json",
	makeImportMapEntriesReal: false,
});
```

## Coverage

When using Fake Imports, blob urls are created for every file you import. For this reason if you want to collect coverage for your tests, the coverage data generated by Deno will be incorrect. To work around this issue, you can generate a coverage map. This map contains info about changes that need
to be made to the coverage data in order to make it accurate again.

### Generating coverage maps via the command line

To generate coverage maps via the command line, you can use the `--fi-coverage-map` argument. To generate a coverage map for tests for instance, you would run your tests like so:

```
deno test --coverage=./deno_coverage_dir -- --fi-coverage-map=./fi_coverage_dir
```

The extra `--` is required to distinguish between arguments passed to Deno and arguments passed to your application.

### Applying coverage maps

To apply the coverage map to your Deno coverage data you can run `applyCoverageMap.js`:

```
deno run --allow-read --allow-write https://deno.land/x/fake_imports/applyCoverageMap.js ./fi_coverage_dir ./deno_coverage_dir
```

This replaces the blob urls in the deno coverage data with the original urls. And in case changes have been made to the contents of imported scripts via `importer.fakeModule`, the coverage positions will be offset in order to match the positions of the real script.

### Generating coverage maps via the api

Alternatively, a few methods are available for obtaining coverage map data via the api:

```js
const importer = new Importer(import.meta.url, {
	generateCoverageMap: true,
});
importer.onCoverageMapEntryAdded((entry) => {
	// do stuff with entry here
});
// or after importing your modules:
const coverageMap = importer.getCoverageMap();
```

## How it works internally

When you import via `importer.import()`, the resource is first downloaded using `fetch()`. The content is then parsed and any `import`s from the file get the same treatment recursively. Then the content of all downloads are passed into `URL.createObjectURL()`, replacing all `import` statements with
the generated object URL. Finally, the root file is loaded using a regular `await import()`. Causing all files to get parsed and executed by the JavaScript parser of the system. Except, instead of running the real files, it runs all code from the created `blob:` urls.

## Caveats

- Circular imports are not supported. Because of the way object URLs work, it is unfortunately not possible to load modules in a circular manner. To make this work, it would require the loader to first create all object URLs, and then modify the imported script urls from the files afterwards. And
  there is currently no way of doing this using object URLs.
- Because `fetch()` is being used, the `--allow-net` permission is required. If you want to load scripts from the disk, `--allow-read` is also required.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
