import { assertEquals } from "asserts";
import { computeDiffOffsets } from "../../../src/computeDiffOffsets.js";

Deno.test({
  name: "Unchanged",
  fn: () => {
    const from = "unchanged";
    const to = "unchanged";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
    ]);
  },
});

Deno.test({
  name: "Addition at the start",
  fn: () => {
    const from = "000";
    const to = "addition\n000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 9],
    ]);
  },
});

Deno.test({
  name: "Addition in the middle",
  fn: () => {
    const from = "000\n000";
    const to = "000\naddition\n000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
      [4, 9],
    ]);
  },
});

Deno.test({
  name: "Addition at the end",
  fn: () => {
    const from = "000\n";
    const to = "000\naddition";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
    ]);
  },
});

Deno.test({
  name: "Removal at the start",
  fn: () => {
    const from = "removal\n000";
    const to = "000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, null],
      [8, -8],
    ]);
  },
});

Deno.test({
  name: "Removal in the middle",
  fn: () => {
    const from = "000\nremoval\n000";
    const to = "000\n000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
      [4, null],
      [12, -8],
    ]);
  },
});

Deno.test({
  name: "Removal at the end",
  fn: () => {
    const from = "000\nremoval";
    const to = "000\n";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
      [4, null],
    ]);
  },
});

Deno.test({
  name: "Replacement",
  fn: () => {
    const from = "000\nold\n000";
    const to = "000\nnew\n000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
      [4, null],
      [8, 0],
    ]);
  },
});
