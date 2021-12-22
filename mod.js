import {ImportResolver} from "./src/ImportResolver.js";

/**
 * @param {string | URL} importMeta
 */
export function createImport(importMeta) {
	const resolver = new ImportResolver(importMeta);
	return resolver.getImportFunction();
}
