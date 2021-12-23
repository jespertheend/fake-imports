/**
 * @param {import("./parseImports.js").ImportLocation[]} importLocations
 * @param {string[]} replacedImports
 * @param {string} scriptSource
 */
export function replaceImports(importLocations, replacedImports, scriptSource) {
	if (importLocations.length == 0) return scriptSource;

	let newScriptSource = "";
	for (let i = 0; i < importLocations.length; i++) {
		const currentImport = importLocations[i];
		const nextImport = importLocations[i + 1];

		if (i == 0) {
			newScriptSource += scriptSource.slice(0, currentImport.start);
		}

		newScriptSource += replacedImports[i];

		if (nextImport) {
			newScriptSource += scriptSource.slice(currentImport.start + currentImport.length, nextImport.start);
		} else {
			newScriptSource += scriptSource.slice(currentImport.start + currentImport.length);
		}
	}

	return newScriptSource;
}
