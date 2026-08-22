// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync
} from "node:fs";
import {
  dirname,
  extname,
  resolve
} from "node:path";
import { test } from "node:test";

// CONSTANTS
const kPackageRoot = resolve(import.meta.dirname, "../..");
const kDocsRoot = resolve(kPackageRoot, "docs");
const kApiRoot = resolve(kDocsRoot, "api");
const kCustomElementPattern = /@customElement\("(jolly-[^"]+)"\)/g;
const kMarkdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
const kPropertyPattern = /@property\([\s\S]*?\)\s+declare\s+(\w+)/g;

function filesWithin(
  directory: string,
  extension: string
): Array<string> {
  return readdirSync(directory, {
    recursive: true,
    withFileTypes: true
  })
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name))
    .filter((path) => extname(path) === extension);
}

function customElementTags(): Array<string> {
  const tags = filesWithin(
    resolve(kPackageRoot, "src"),
    ".ts"
  ).flatMap((path) => {
    const source = readFileSync(path, "utf8");

    return [...source.matchAll(kCustomElementPattern)]
      .map((match) => match[1]);
  });

  return tags.sort();
}

test("every custom element has one API page", () => {
  const pages = filesWithin(kApiRoot, ".md").map((path) => {
    return {
      path,
      source: readFileSync(path, "utf8")
    };
  });

  for (const tag of customElementTags()) {
    const heading = `# \`${tag}\``;
    const matches = pages.filter(({ source }) => source.includes(heading));

    assert.equal(
      matches.length,
      1,
      `${tag} must have exactly one API page`
    );
  }
});

test("component pages name their declared reactive properties", () => {
  const pages = filesWithin(kApiRoot, ".md")
    .map((path) => readFileSync(path, "utf8"));
  const sourceFiles = filesWithin(
    resolve(kPackageRoot, "src"),
    ".ts"
  );

  for (const path of sourceFiles) {
    const source = readFileSync(path, "utf8");
    const tags = [...source.matchAll(kCustomElementPattern)]
      .map((match) => match[1]);
    if (tags.length === 0) {
      continue;
    }

    assert.equal(tags.length, 1, `${path} declares one custom element`);
    const page = pages.find(
      (candidate) => candidate.includes(`# \`${tags[0]}\``)
    );
    assert.notEqual(page, undefined, `${tags[0]} has an API page`);

    const properties = [...source.matchAll(kPropertyPattern)]
      .map((match) => match[1]);
    for (const property of properties) {
      assert.equal(
        page?.includes(`\`${property}\``),
        true,
        `${tags[0]} API page must name ${property}`
      );
    }
  }
});

test("documentation links resolve", () => {
  const files = [
    resolve(kPackageRoot, "README.md"),
    ...filesWithin(kDocsRoot, ".md")
  ];

  for (const path of files) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(kMarkdownLinkPattern)) {
      const target = match[1]
        .replace(/^<|>$/g, "")
        .split("#", 1)[0];
      if (
        target === "" ||
        /^[a-z]+:/i.test(target) ||
        extname(target) !== ".md"
      ) {
        continue;
      }

      const resolved = resolve(dirname(path), decodeURI(target));
      assert.equal(
        existsSync(resolved),
        true,
        `${path} links to missing ${target}`
      );
    }
  }
});
