# Fake Imports

[![Github ci](https://github.com/jespertheend/fake-imports/actions/workflows/ci.yml/badge.svg)](https://github.com/jespertheend/fake-imports/actions/workflows/ci.yml)
[![Deno version](https://shields.io/github/v/release/jespertheend/fake-imports?label=Deno.land/x&logo=deno)](https://deno.land/x/fake_imports)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/fake_imports@v0.0.2/mod.js/~/Importer)
[![license](https://img.shields.io/github/license/jespertheend/fake-imports)](https://github.com/jespertheend/fake-imports/blob/master/LICENSE)

This is a small module for Deno and browser environments that can be used for
blocking specific imports using the esm `import` syntax. It is mostly meant for
Stubbing and Mocking modules in unit tests, but can be used for other purposes
as well.

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

In theory this should work, because in our test the div isn't used. But if we
run `deno test` we get:

```
error: Uncaught ReferenceError: document is not defined
const div = document.createElement("div");
            ^
```

Because `module_with_side_effects.js` has side effects, the div is created the
moment the module is imported. Ideally a problem like this would prompt you to
rewrite your code so that no modules have any side effects, but this isn't
always feasible.

This module was created to solve this problem. By allowing you to overwrite the
code of an imported file, you can change its behaviour, or prevent it from doing
anything at all.

---

## Usage

Let's take our previous test as an example. Rather than importing `"./foo.js"`
directly, we'll create a `new Importer()` and load `"./foo.js"` dynamically
inside the test itself:

```js
import { Importer } from "https://deno.land/x/fake_imports/mod.js";
const importer = new Importer(import.meta.url);

Deno.test("getX", async () => {
  const { Foo } = await importer.import("./foo.js");
});
```

Now we'll replace the content of `"./module_with_side_effects.js"` so that it
has no side effects:

```js
importer.fakeModule(
  "./module_with_side_effects.js",
  "export function getDiv() {}",
);
```

And then just continue running your test like usual. Be sure to run it with
`--allow-read` and `--allow-net`. Here's what that the full file looks like:

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

For more complex cases, it is also possible for faked modules to import
themselves.

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

You can also pass in a function, if you want complete controll over what gets
modified:

```js
const importer = new Importer(import.meta.url);
importer.fakeModule("./original.js", (original) => {
  return original.fullContent.replace("foo", "bar");
});
```

## Coverage

When using Fake Imports, blob urls are created for every file you import. For this reason if you want to collect coverage for your tests, the coverage data generated by Deno will be incorrect. To work around this issue, you can generate a coverage map. This map contains info about changes that need to be made to the coverage data in order to make it accurate again.

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
const importer = new Importer(import.meta.url);
importer.onCoverageMapEntryAdded((entry) => {
  // do stuff with entry here
});
// or after importing your modules:
const coverageMap = importer.getCoverageMap();
```

### Waiting for writes to finish
When using `--fi-coverage-map` with `deno test`, you might end up finishing your test before the coverage map has finished writing to disk. In that case Deno will fail the test with `AssertionError: Test case is leaking async ops.` To fix this issue, you could set `sanitizeOps` and `sanitizeResources` to false on your test, but it would be better to wait for the writes to finish:

```js
const importer = new Importer(import.meta.url);

// do your test

await importer.finishCoverageMapWrites();
```

Though with tests commonly being async already, and coverage map writes being pretty fast in most cases, it might happen that your test passes even without using `finishCoverageMapWrites`. This would cause your test to get flaky though. To ensure you didn't accidentally forget to wait for the writes, you can force writes to take a little longer with `--fi-force-coverage-map-write-timeout=1000`. This will make all writes take one second to finish. That way you can easily verify which of your tests would fail in case writes take longer.

---

## How it works internally

When you import via `importer.import()`, the resource is first downloaded using
`fetch()`. The content is then parsed and any `import`s from the file get the
same treatment recursively. Then the content of all downloads are passed into
`URL.createObjectURL()`, replacing all `import` statements with the generated
object URL. Finally, the root file is loaded using a regular `await import()`.
Causing all files to get parsed and executed by the JavaScript parser of the
system. Except, instead of running the real files, it runs all code from the
created `blob:` urls.

## Caveats

- Circular imports are not supported. Because of the way object URLs work, it is
  unfortunately not possible to load modules in a circular manner. To make this
  work, it would require the loader to first create all object URLs, and then
  modify the imported script urls from the files afterwards. And there is
  currently no way of doing this using object URLs.
- Because `fetch()` is being used, the `--allow-net` permission is required. If
  you want to load scripts from the disk, `--allow-read` is also required.
