import { diffLines } from "https://unpkg.com/diff@5.0.0/lib/index.mjs";

/** @typedef {[number, (number | null)]} DiffOffsetRange */
/** @typedef {DiffOffsetRange[]} DiffOffsets */

/**
 * Computes the diff between two texts, and extracts the data required to map
 * an index from `from` to `to`.
 * The returned value is an array of tuples, where each tuple represents an
 * offset in the format [originalIndex, offset].
 * So if a tuple like [10, -20] for instance means that any indices after the
 * 10th character need to be shifted 20 to the left.
 * Two tuples such as [10, -20] and [20, 10] means that any index between 10
 * and 20 need to be shifted 20 to the left, and any character after that needs
 * to be shifted 10 to the right.
 *
 * @param {string} from
 * @param {string} to
 */
export function computeDiffOffsets(from, to) {
  const diff = diffLines(from, to);
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
