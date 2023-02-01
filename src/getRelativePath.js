import { posix } from "https://deno.land/std@0.121.0/path/mod.ts";

/**
 * Returns a relative path between two absolute paths.
 * @param {string} pathA
 * @param {string} pathB
 */
export function getRelativePath(pathA, pathB) {
	const a = posix.fromFileUrl(pathA);
	const b = posix.fromFileUrl(pathB);
	let rel = posix.relative(a, b);
	if (!rel.startsWith("/") && !rel.startsWith(".")) {
		rel = "./" + rel;
	}
	return rel;
}
