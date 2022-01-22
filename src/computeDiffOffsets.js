import { diffChars } from "https://unpkg.com/diff@5.0.0/lib/index.mjs";

/** @typedef {[number, (number | null)]} DiffOffsetRange  */
/** @typedef {DiffOffsetRange[]} DiffOffsets  */

/**
 * Computes the diff between two texts, and extracts the data required to map
 * an index from str1 to str2.
 * @param {string} from
 * @param {string} to
 */
export function computeDiffOffsets(from, to) {
  const diff = diffChars(from, to);
  /** @type {DiffOffsets} */
  const offsets = [];
  let cursor = 0;
  let currentOffset = 0;
  for (const part of diff) {
    if (part.added) {
      currentOffset += part.value.length;
      continue;
    }
    if (part.removed) {
      offsets.push([cursor, null]);
      currentOffset -= part.value.length;
    } else {
      offsets.push([cursor, currentOffset]);
    }
    cursor += part.value.length;
  }
  return offsets;
}
