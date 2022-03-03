import { assertThrows } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { CollectedImport } from "../../../src/CollectedImport.js";

Deno.test({
  name: "getCoverageMapEntry throws if generating CoverageMaps is disabled",
  fn() {
    const mockResolver =
      /** @type {import("../../../src/ImportResolver.js").ImportResolver} */ ({
        generateCoverageMap: false,
      });
    const collectedImport = new CollectedImport(
      "https://example.com/fake.js",
      mockResolver,
    );
    assertThrows(() => collectedImport.getCoverageMapEntry());
  },
});
