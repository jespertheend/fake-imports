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
    let lineAfterStrings = line;
    while (lineAfterStrings.length > 0) {
      const commentIndex = lineAfterStrings.indexOf("//");
      const contentBeforeComment = lineAfterStrings.slice(0, commentIndex);
      const singleQuoteCount = (contentBeforeComment.match(/'/g) || []).length;
      const doubleQuoteCount = (contentBeforeComment.match(/"/g) || []).length;

      // If there is an uneven number of quotes,
      // that means the comment is inside a string
      if (singleQuoteCount % 2 == 1 || doubleQuoteCount % 2 == 1) {
        const lastSingleQuoteIndex = contentBeforeComment.lastIndexOf(`'`);
        const lastDoubleQuoteIndex = contentBeforeComment.lastIndexOf(`"`);
        const lastQuoteIndex = Math.max(
          lastSingleQuoteIndex,
          lastDoubleQuoteIndex,
        );
        const contentAfterLastQuote = lineAfterStrings.slice(
          lastQuoteIndex + 1,
        );
        const lastQuoteType = lastSingleQuoteIndex > lastDoubleQuoteIndex
          ? `'`
          : `"`;
        const nextQuoteIndex = contentAfterLastQuote.indexOf(lastQuoteType);
        lineAfterStrings = contentAfterLastQuote.slice(nextQuoteIndex + 1);
      } else {
        if (commentIndex >= 0) {
          const charactersBeforeStrings = line.length - lineAfterStrings.length;
          commentLocations.push({
            start: totalIndex + charactersBeforeStrings + commentIndex,
            end: totalIndex + line.length,
          });
        }
        break;
      }
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
