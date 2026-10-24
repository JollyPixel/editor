// Import Node.js Dependencies
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  before,
  describe,
  it
} from "node:test";

// Import Third-party Dependencies
import {
  build,
  type Rolldown
} from "vite";

// CONSTANTS
const kPackageDir = path.join(import.meta.dirname, "..", "..");
const kSrcDir = path.join(kPackageDir, "src");
const kFacadeDir = path.join(kSrcDir, "facade");
const kFacadeEntry = path.join(kFacadeDir, "index.ts");
const kElementEntries = readdirSync(path.join(kSrcDir, "elements"))
  .map((file) => path.join(kSrcDir, "elements", file));
const kElementTags = new Set(
  kElementEntries.map((entry) => `jolly-${path.basename(entry, ".ts")}`)
);
const kPlainEntries = Object.values(
  JSON.parse(readFileSync(path.join(kPackageDir, "package.json"), "utf8"))
    .exports as Record<string, { default: string; }>
)
  .filter((target) => !target.default.includes("*"))
  .map((target) => path.join(
    kPackageDir,
    target.default.replace("./dist/", "./src/").replace(/\.js$/, ".ts")
  ))
  .filter((entry) => entry !== kFacadeEntry);
const kDefinedTag = /@customElement\("(jolly-[a-z0-9-]+)"\)/g;
const kRenderedTag = /<(jolly-[a-z0-9-]+)|createElement\("(jolly-[a-z0-9-]+)"\)/g;
const kTagLiteral = /"(jolly-[a-z0-9-]+)"/g;

function tagsIn(
  file: string,
  pattern: RegExp
): string[] {
  return Array.from(
    readFileSync(file, "utf8").matchAll(pattern),
    (match) => match[1] ?? match[2]
  );
}

async function bundle(
  input: string[]
): Promise<Map<string, string[]>> {
  const result = await build({
    configFile: false,
    root: kSrcDir,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      rolldownOptions: {
        input,
        external: [/^lit/, /^@lit/, /^@jolly-pixel\//]
      }
    }
  }) as Rolldown.RolldownOutput;
  const chunks = new Map(result.output.flatMap(
    (file) => (file.type === "chunk" ? [[file.fileName, file]] : [])
  ));

  return new Map([...chunks.values()]
    .filter((chunk) => chunk.isEntry)
    .map((entry) => {
      const closure = new Set([entry]);
      for (const chunk of closure) {
        for (const name of chunk.imports) {
          const imported = chunks.get(name);
          if (imported) {
            closure.add(imported);
          }
        }
      }
      const modules = [...closure]
        .flatMap((chunk) => chunk.moduleIds)
        .map((id) => path.resolve(id))
        .filter((id) => id.startsWith(kSrcDir));

      return [path.resolve(entry.facadeModuleId!), modules];
    }));
}

describe("element registration", () => {
  let bundled: Map<string, string[]>;

  before(async() => {
    bundled = new Map([
      ...await bundle(kPlainEntries),
      ...await bundle([kFacadeEntry]),
      ...await bundle(kElementEntries)
    ]);
  });

  it("keeps every entry but the elements and the facade free of custom elements", () => {
    for (const entry of kPlainEntries) {
      assert.deepEqual(
        bundled.get(entry)!
          .filter((id) => tagsIn(id, kDefinedTag).length > 0)
          .map((id) => path.relative(kSrcDir, id)),
        [],
        `${path.relative(kSrcDir, entry)} registers an element`
      );
    }
  });

  it("gives every custom element an entry named after its tag", () => {
    const defined = readdirSync(kSrcDir, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".ts"))
      .flatMap((file) => tagsIn(path.join(kSrcDir, file), kDefinedTag));

    assert.deepEqual(defined.sort(), [...kElementTags].sort());
  });

  it("registers every tag the facade names", () => {
    const defined = new Set(
      bundled.get(kFacadeEntry)!.flatMap((id) => tagsIn(id, kDefinedTag))
    );
    const unregistered = readdirSync(kFacadeDir)
      .flatMap((file) => tagsIn(path.join(kFacadeDir, file), kTagLiteral))
      .filter((tag) => kElementTags.has(tag) && !defined.has(tag));

    assert.deepEqual([...new Set(unregistered)], []);
  });

  it("registers every tag an element entry renders", () => {
    for (const entry of kElementEntries) {
      const modules = bundled.get(entry)!;
      const defined = new Set(modules.flatMap((id) => tagsIn(id, kDefinedTag)));
      const unregistered = modules
        .flatMap((id) => tagsIn(id, kRenderedTag))
        .filter((tag) => !defined.has(tag));

      assert.deepEqual(
        [...new Set(unregistered)],
        [],
        `${path.basename(entry)} renders a tag it does not register`
      );
    }
  });
});
