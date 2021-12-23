import { ImportResolver } from "./src/ImportResolver.js";

export class Importer {
  #resolver;

  /**
   * @param {string | URL} importMeta
   */
  constructor(importMeta) {
    this.#resolver = new ImportResolver(importMeta);
  }

  /**
   * @template T
   * @param {string | URL} url
   * @returns {Promise<T>}
   */
  async import(url) {
    return await this.#resolver.import(url);
  }

  /**
   * @param {string | URL} url
   * @param {string} moduleImplementation
   */
  fakeModule(url, moduleImplementation) {
    this.#resolver.registerFakeModule(url, moduleImplementation);
  }
}
