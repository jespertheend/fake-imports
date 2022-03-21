import { assertThrows } from "asserts";
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
