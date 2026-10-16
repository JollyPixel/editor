// Import Node.js Dependencies
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { SourceMapFile } from "./analysis/SourceMapFile.ts";
import { Tally } from "./analysis/Tally.ts";
import {
  BenchEditors,
  type BenchEditor
} from "./harness/BenchEditors.ts";

const { values: args } = parseArgs({
  options: {
    editors: { type: "string", default: "voxel-map,voxel-model,pixel-art" },
    top: { type: "string", default: "15" }
  }
});

const editors = await BenchEditors.read();
for (const editor of editors.select(args.editors.split(","))) {
  report(editor);
}

function report(
  editor: BenchEditor
): void {
  const preloaded = eagerChunks(editor);
  const eager = new Tally();
  const lazy = new Tally();
  let raw = 0;
  let gzip = 0;
  let brotli = 0;

  for (const name of readdirSync(path.join(editor.dist, "assets"))) {
    if (!name.endsWith(".js")) {
      continue;
    }
    const file = path.join(editor.dist, "assets", name);
    const isEager = preloaded.has(`assets/${name}`);
    countPackages(file, isEager ? eager : lazy);
    if (isEager) {
      const code = readFileSync(file);
      raw += code.length;
      gzip += gzipSync(code, { level: 9 }).length;
      brotli += brotliCompressSync(code).length;
    }
  }

  console.log(
    `\n## ${editor.name}: eager ${kb(raw)} raw, ${kb(gzip)} gzip, ${kb(brotli)} brotli`,
    `(${preloaded.size} files)`
  );
  print("Eager bytes by package", eager);
  print("Lazy bytes by package", lazy);
}

function eagerChunks(
  editor: BenchEditor
): Set<string> {
  const html = readFileSync(path.join(editor.dist, "index.html"), "utf8");

  return new Set(
    Array.from(html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.js)"/g), ([, chunk]) => chunk)
  );
}

function countPackages(
  file: string,
  tally: Tally
): void {
  const code = readFileSync(file, "utf8");
  const size = Buffer.byteLength(code);
  const map = SourceMapFile.load(file);
  if (map === null) {
    tally.add("(no source map)", size);

    return;
  }

  let mapped = 0;
  for (const span of map.generatedSpans(code)) {
    tally.add(span.package ?? "(generated)", span.bytes);
    mapped += span.bytes;
  }
  tally.add("(unmapped)", Math.max(0, size - mapped));
}

function kb(
  bytes: number
): string {
  return `${Math.round(bytes / 1024)} KB`;
}

function print(
  title: string,
  tally: Tally
): void {
  console.log(`${title}:`);
  for (const { key, total } of tally.top(Number(args.top))) {
    console.log(`  ${kb(total).padStart(9)}  ${key}`);
  }
}
