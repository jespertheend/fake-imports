import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { getCommentLocations } from "../../../src/parseComments.js";

Deno.test({
  name: "single line comment",
  fn() {
    const source = `// comment`;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 0, end: 10 },
    ]);
  },
});

Deno.test({
  name: "line comment after non comment",
  fn() {
    const source = `
      not a comment // comment
    `;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 21, end: 31 },
    ]);
  },
});

Deno.test({
  name: "line comment in between non comments",
  fn() {
    const source = `
      not a comment
      not a comment // comment
      not a comment
    `;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 41, end: 51 },
    ]);
  },
});

Deno.test({
  name: "multiple line comments",
  fn() {
    const source = `
      // comment
      not a comment
      not a comment // comment
      not a comment // comment
      not a comment
      not a comment // comment
    `;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 7, end: 17 },
      { start: 58, end: 68 },
      { start: 89, end: 99 },
      { start: 140, end: 150 },
    ]);
  },
});

Deno.test({
  name: "block comment",
  fn() {
    const source = `/* comment */`;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 0, end: 13 },
    ]);
  },
});

Deno.test({
  name: "multi line block comment",
  fn() {
    const source = `
      /*
       comment
       */
    `;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 7, end: 34 },
    ]);
  },
});

Deno.test({
  name: "jsdoc style comment",
  fn() {
    const source = `
      /**
       * @fileoverview test
       */
    `;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 7, end: 48 },
    ]);
  },
});

Deno.test({
  name: "line comment inside block comment",
  fn() {
    const source = `
      /*
      // comment
      */
    `;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 7, end: 35 },
    ]);
  },
});

Deno.test({
  name: "block comment between non comments",
  fn() {
    const source = `
      not a comment
      /* comment */
      not a comment
    `;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 27, end: 40 },
    ]);
  },
});

Deno.test({
  name: "block comment inside line comment",
  fn() {
    const source = `
      // comment /* comment */
      not a comment
    `;

    const result = getCommentLocations(source);

    assertEquals(result, [
      { start: 7, end: 31 },
    ]);
  },
});
