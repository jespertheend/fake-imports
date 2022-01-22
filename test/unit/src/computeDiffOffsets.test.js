// @ts-check

import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
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
    const to = "addition 000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 9],
    ]);
  },
});

Deno.test({
  name: "Addition in the middle",
  fn: () => {
    const from = "000000";
    const to = "000 addition 000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
      [3, 10],
    ]);
  },
});

Deno.test({
  name: "Addition at the end",
  fn: () => {
    const from = "000";
    const to = "000 addition";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
    ]);
  },
});

Deno.test({
  name: "Removal at the start",
  fn: () => {
    const from = "removal 000";
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
    const from = "000 removal 000";
    const to = "000000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
      [3, null],
      [12, -9],
    ]);
  },
});

Deno.test({
  name: "Removal at the end",
  fn: () => {
    const from = "000 removal";
    const to = "000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
      [3, null],
    ]);
  },
});

Deno.test({
  name: "Replacement",
  fn: () => {
    const from = "000 old 000";
    const to = "000 new 000";

    const result = computeDiffOffsets(from, to);

    assertEquals(result, [
      [0, 0],
      [4, null],
      [7, 0],
    ]);
  },
});
