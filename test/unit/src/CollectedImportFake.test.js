import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { CollectedImportFake } from "../../../src/CollectedImportFake.js";

Deno.test("handleResolveImport", () => {
  const stubResolver = {};
  // stub the init method
  CollectedImportFake.prototype.init = async () => {};

  const script = "file:///fake.js";

  const collectedImport = new CollectedImportFake(
    "import { foo } from './fake.js';",
    script,
    /** @type {any} */ (stubResolver),
  );

  const resolveData = collectedImport.handleResolveImport(script);
  assertEquals(resolveData, {
    url: script,
    forceNoFake: true,
  });
});
