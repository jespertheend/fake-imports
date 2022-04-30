/**
 * @typedef CommentLocation
 * @property {number} start
 * @property {number} end
 */

/**
 * @param {string} scriptSource
 */
export function getCommentLocations(scriptSource) {
  /** @type {CommentLocation[]} */
  const commentLocations = [];
  let totalIndex = 0;
  for (const line of scriptSource.split("\n")) {
    const commentIndex = line.indexOf("//");
    if (commentIndex >= 0) {
      commentLocations.push({
        start: totalIndex + commentIndex,
        end: totalIndex + line.length,
      });
    }
    totalIndex += line.length + "\n".length;
  }

  const blockCommentRegex = /\/\*[\s\S]*?\*\//g;
  for (const match of scriptSource.matchAll(blockCommentRegex)) {
    if (match.index == undefined) continue;
    commentLocations.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  commentLocations.sort((a, b) => a.start - b.start);

  // Merge overlapping comments
  const mergedCommentLocations = [];
  let lastCommentLocation = null;
  for (const location of commentLocations) {
    if (lastCommentLocation) {
      if (location.start >= lastCommentLocation.end) {
        mergedCommentLocations.push(location);
        lastCommentLocation = location;
      } else {
        lastCommentLocation.end = Math.max(
          lastCommentLocation.end,
          location.end,
        );
      }
    } else {
      mergedCommentLocations.push(location);
      lastCommentLocation = location;
    }
  }
  return mergedCommentLocations;
}
