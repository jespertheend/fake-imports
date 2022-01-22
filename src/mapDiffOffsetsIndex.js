/**
 * Maps a character index from one text to another using the provided offsets.
 * @param {number} index
 * @param {import("./computeDiffOffsets.js").DiffOffsets} offsets
 */
export function mapIndex(index, offsets) {
  let newIndex = index;
  /** @type {import("./computeDiffOffsets.js").DiffOffsetRange?} */
  let foundOffset = null;
  /** @type {import("./computeDiffOffsets.js").DiffOffsetRange?} */
  let prevOffset = null;
  /** @type {import("./computeDiffOffsets.js").DiffOffsetRange?} */
  let lastNonNullOffset = null;
  /** @type {import("./computeDiffOffsets.js").DiffOffsetRange?} */
  let oneAfterLastNonNullOffset = null;
  let stopOnNextNonNullOffset = false;

  for (let i = 0; i < offsets.length; i++) {
    const currentOffset = offsets[i];

    if (index < currentOffset[0]) {
      if (lastNonNullOffset) {
        foundOffset = lastNonNullOffset;
        if (lastNonNullOffset != prevOffset) {
          if (oneAfterLastNonNullOffset) {
            newIndex = oneAfterLastNonNullOffset[0];
          } else {
            newIndex = lastNonNullOffset[0];
          }
        }
        break;
      } else {
        stopOnNextNonNullOffset = true;
      }
    }

    if (stopOnNextNonNullOffset && currentOffset[1] !== null) {
      foundOffset = currentOffset;
      newIndex = currentOffset[0];
      break;
    }

    if (currentOffset[1] != null) {
      lastNonNullOffset = currentOffset;
      oneAfterLastNonNullOffset = offsets[i + 1];
    }
    prevOffset = currentOffset;
  }

  if (!foundOffset) {
    foundOffset = lastNonNullOffset;
    const lastOffset = offsets[offsets.length - 1];
    if (lastOffset[1] == null && oneAfterLastNonNullOffset) {
      newIndex = oneAfterLastNonNullOffset[0];
    }
  }

  if (!foundOffset || foundOffset[1] == null) {
    return 0;
  }
  return newIndex + foundOffset[1];
}
