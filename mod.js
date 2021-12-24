import { ImportResolver } from "./src/ImportResolver.js";

export class Importer {
  #resolver;

  /**
   * Creates a new Importer instance. Creating multiple instances is supported
   * and will cause scripts to get loaded in a somewhat isolated state. They'll
   * be isolated in that modifications to a script imported from one importer
   * do not affect other importers. However, if a script makes modifications
   * to the global scope, this is not the case.
   *
   * For instance:
   * ### foo.js
   * ```js
   * const someObject = { modified: false };
   * export default someObject;
   * ```
   *
   * ### modifyIt.js
   * ```js
   * import { someObject } from "foo.js";
   * someObject.modified = true;
   * ```
   *
   * ### run.js
   * ```js
   * const importer1 = new Importer(import.meta.url);
   * await importer1.import("./modifyIt.js");
   * const result1 = await importer1.import("./foo.js");
   * console.log(result1.modified); // true
   *
   * const importer2 = new Importer(import.meta.url);
   * const result2 = await importer2.import("./foo.js");
   * console.log(result2.modified); // false
   * ```
   * @param {string | URL} importMeta
   */
  constructor(importMeta) {
    this.#resolver = new ImportResolver(importMeta);
  }

  /**
   * Import a script. Similar to using the
   * [dynamic `import()` statement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#dynamic_imports).
   * Except with the faked modules applied.
   * @template T
   * @param {string | URL} url
   * @returns {Promise<T>}
   */
  async import(url) {
    return await this.#resolver.import(url);
  }

  /**
   * Fakes a module.
   * @param {string | URL} url should be relative to the `importMeta` argument
   * provided in the {@link constructor}.
   * @param {string} moduleImplementation The code to replace the imported content with.
   */
  fakeModule(url, moduleImplementation) {
    this.#resolver.registerFakeModule(url, moduleImplementation);
  }
}
