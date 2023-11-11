# Fake Imports

[![Github ci](https://github.com/jespertheend/fake-imports/actions/workflows/ci.yml/badge.svg)](https://github.com/jespertheend/fake-imports/actions/workflows/ci.yml)
[![Deno version](https://shields.io/github/v/release/jespertheend/fake-imports?label=Deno.land/x&logo=deno&include_prereleases)](https://deno.land/x/fake_imports) [![npm](https://img.shields.io/npm/v/fake-imports)](https://www.npmjs.com/package/fake-imports)
[![license](https://img.shields.io/github/license/jespertheend/fake-imports)](https://github.com/jespertheend/fake-imports/blob/master/LICENSE)

This is a small module for Deno and browser environments that can be used for modifying the contents of imported modules.
It can be used for stubbing or mocking modules in unit tests, among other things.

Take the following module for instance:

```js
import {initConnection} from = "./database.js";

export async function readAndReturn() {
	const connection = initConnection();
	// Read something from the database
}
```

If you want to write tests for the `readAndReturn()` call, there is no way to prevent the `initConnection()` from being called.
Ideally, a problem like this would prompt you to rewrite your code to use dependency injection, but this doesn't always make sense.

This module was created to solve this problem. By allowing you to replace the contents of an imported file,
you can change its behavior, or prevent it from doing anything at all.

## Usage

Let's take the previous example and assume that the file is called `readAndReturn.js`.
Rather than importing this file directly, we'll create a `new Importer()` and load `"./readAndReturn.js"` dynamically:

```js
import { Importer } from "https://deno.land/x/fake_imports/mod.js";
const importer = new Importer(import.meta.url);

const { readAndReturn } = await importer.import("./readAndReturn.js");
```

(note that in browser environments you can import from https://cdn.jsdelivr.net/npm/fake-imports@latest/dist/fake_imports.js)

This `importer.import()` method works pretty much the same as a regular dynamic `import()`,
except that you get to modify files before you import them!

Right now the call to `readAndReturn()` would still try to connect to the database.
Let's try to modify the contents of `database.js` before we import it:

```js
importer.fakeModule(
	"./database.js",
	`
	export function initConnection() {}
`,
);

const { readAndReturn } = await importer.import("./readAndReturn.js");
readAndReturn(); // This should now work!
```

## Modifying existing content

For more complex cases, it is also possible for faked modules to import themselves.
This allows you to modify the state of the module right before it gets exported.

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

You can use a callback if you want complete control over what gets modified.
The callback should return a string that contains the new content of the module.
The callback receives a parameter with data about the original module,
that way you can replace only specific words for example:

```js
const importer = new Importer(import.meta.url);
importer.fakeModule("./original.js", (original) => {
	return original.fullContent.replace("foo", "bar");
});
```

## Preventing modules from being faked

Faked modules come with [some limitations](#caveats), such as circular imports not being supported.
On top of that, each imported file [creates a new object URL](#how-it-works-internally), so it's best to not import very large module graphs.

Not to worry though! If there are modules that you wish to keep untouched,
you can use `makeReal()` to prevent object URLs from being created for certain files.

```js
const importer = new Importer(import.meta.url);
importer.makeReal("./Foo.js");
```

In the example above, if any module imports `Foo.js`, it won't be replaced by object URLs.
As a result, any modules imported by `Foo.js` won't be replaced either.

## Working with `instanceof`

Another reason you might want to make modules real is that classes imported using `await importer.import()` and actual `import` syntax are not the same.
So if you are using `instanceof` it might not work as you would expect:

```js
import { Foo as RealFoo } from "./Foo.js";

const importer = new Importer(import.meta.url);
const { Foo } = await importer.import("./Foo.js");

const foo = new Foo();
console.log(foo instanceof RealFoo); // false
```

You can fix this by using `makeReal()` as well.
The above is a bit of a silly example because it doesn't really make sense to import the same file twice like that.
But a more realistic scenario would be one where another file imports `Foo.js`:

```js
import { Foo as RealFoo } from "./Foo.js";

const importer = new Importer(import.meta.url);
const { makeFooInstance } = await importer.import("./makeFooInstance.js");

const foo = makeFooInstance();
console.log(foo instanceof RealFoo); // true
```

## Import maps

By default, an `Importer` is created without an import map. Even when you have already specified one using `<script type="importmap">` or `--import-map`.
So if you want to use it, you'll have to provide it again when instantiating the `Importer`. This can be done with `importMap` option:

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

Import maps are assumed to be used for large libraries and generally things that don't need to be faked. So by default, all entries from the provided import map are [marked as real](#preventing-modules-from-being-faked). If you don't want this to happen you can set `makeImportMapEntriesReal` to false:

```js
const importer = new Importer(import.meta.url, {
	importMap: "./path/to/importMap.json",
	makeImportMapEntriesReal: false,
});
```

## Coverage

When using Fake Imports, object URLs are created for every file you import.
For this reason, if you want to collect coverage for your tests, the coverage data generated by Deno will be incorrect.
To work around this issue, you can generate a coverage map.
This map contains info about changes that need to be made to the coverage data to make it accurate again.

### Generating coverage maps via the command line

To generate coverage maps via the command line, you can use the `--fi-coverage-map` argument.
To generate a coverage map for tests, for instance, you would run your tests like so:

```
deno test --coverage=./deno_coverage_dir -- --fi-coverage-map=./fi_coverage_dir
```

The extra `--` is required to distinguish between arguments passed to Deno and arguments passed to your application.

### Applying coverage maps

To apply the coverage map to your Deno coverage data you can run `applyCoverageMap.js`:

```
deno run --allow-read --allow-write https://deno.land/x/fake_imports/applyCoverageMap.js ./fi_coverage_dir ./deno_coverage_dir
```

This replaces the object URLs in the deno coverage data with the original URLs.
and in case changes have been made to the contents of imported scripts via `importer.fakeModule`,
the coverage positions will be offset in order to match the positions of the real script.

### Generating coverage maps with JavaScript

Alternatively, a few methods are available for obtaining coverage map data with JavaScript:

```js
const importer = new Importer(import.meta.url, {
	generateCoverageMap: true,
});
importer.onCoverageMapEntryAdded((entry) => {
	// do stuff with the entry here
});
// or after you have imported all your modules:
const coverageMap = importer.getCoverageMap();
```

## How it works internally

When you import via `importer.import()`, the resource is first downloaded using `fetch()`.
The content is then parsed and any `import`s from the file get the same treatment recursively.
Then the content of all downloads is passed into `URL.createObjectURL()`,
while replacing all `import` statements with the generated object URL.
Finally, the root file is loaded using a regular `await import()`, causing all object URLs to get parsed and executed.

## Caveats

- Circular imports are not supported. Because of the way object URLs work, this is unfortunately not possible.
  The reason for this is that there is no way to modify the contents of an object URL after it has been created.
  Essentially, when `a.js` imports `b.js`, first an object URL is created for `b.js`, which is then inserted into the content of `a.js`.
  But if `b.js` imports `a.js` as well, a new object URL now needs to be generated for `b.js`,
  causing the two files to generate object URLs for each other forever.
- Because `fetch()` is being used, the `--allow-net` permission is required.
  If you want to load scripts from the disk, `--allow-read` is also required.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
