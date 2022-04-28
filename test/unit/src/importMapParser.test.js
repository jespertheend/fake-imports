import { assertEquals, assertThrows } from "asserts";
import { parseImportMap } from "../../../src/importMapParser.js";

Deno.test({
  name: "parseImportMap() with an array throws",
  fn() {
    const baseUrl = new URL("https://example.com/");
    assertThrows(
      () => {
        parseImportMap(/** @type {any} */ ([]), baseUrl);
      },
      TypeError,
      "The top-level value needs to be a JSON object.",
    );
  },
});

Deno.test({
  name: "parseImportMap() with an array as imports key throws",
  fn() {
    const baseUrl = new URL("https://example.com/");
    assertThrows(
      () => {
        parseImportMap({
          imports: /** @type {any} */ ([]),
        }, baseUrl);
      },
      TypeError,
      `The "imports" top-level key needs to be a JSON object.`,
    );
  },
});

Deno.test({
  name: "parseImportMap() with absolute identifiers",
  fn() {
    const baseUrl = new URL("https://example.com/base/");
    const result = parseImportMap({
      imports: {
        "foo": "https://example.com/foo",
        "bar": "https://example.com/bar",
      },
    }, baseUrl);
    assertEquals(result, {
      imports: {
        foo: new URL("https://example.com/foo"),
        bar: new URL("https://example.com/bar"),
      },
    });
  },
});

Deno.test({
  name: "parseImportMap() with relative identifiers",
  fn() {
    const baseUrl = new URL("https://example.com/base/");
    const result = parseImportMap({
      imports: {
        "./foo": "./newfoo",
        "./bar": "./newbar",
      },
    }, baseUrl);
    assertEquals(result, {
      imports: {
        "https://example.com/base/foo": new URL(
          "https://example.com/base/newfoo",
        ),
        "https://example.com/base/bar": new URL(
          "https://example.com/base/newbar",
        ),
      },
    });
  },
});
