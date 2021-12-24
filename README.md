# Fake Imports

[![Github ci](https://github.com/jespertheend/fake-imports/actions/workflows/ci.yml/badge.svg)](https://github.com/jespertheend/fake-imports/actions/workflows/ci.yml)

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

And then just continue running your test like usual. Here's what that looks
like:

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
