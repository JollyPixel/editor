// Import Node.js Dependencies
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import {
  parseEditors,
  type BenchEditor
} from "./editors.ts";
import {
  SourceMap,
  packageOf
} from "./sourceMap.ts";

const { values: args } = parseArgs({
  options: {
    editors: { type: "string", default: "voxel-map,voxel-model,pixel-art" },
    top: { type: "string", default: "15" }
  }
});

for (const editor of parseEditors(args.editors)) {
  report(editor);
}

function report(
  editor: BenchEditor
): void {
  const preloaded = eagerChunks(editor);
  const eager = new Map<string, number>();
  const lazy = new Map<string, number>();
  let raw = 0;
  let gzip = 0;
  let brotli = 0;

  for (const name of readdirSync(path.join(editor.dist, "assets"))) {
    if (!name.endsWith(".js")) {
      continue;
    }
    const file = path.join(editor.dist, "assets", name);
    const isEager = preloaded.has(`assets/${name}`);
    for (const [pkg, bytes] of bytesByPackage(file)) {
      add(isEager ? eager : lazy, pkg, bytes);
    }
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

function bytesByPackage(
  file: string
): Map<string, number> {
  const code = readFileSync(file, "utf8");
  const bytes = new Map<string, number>();
  const map = SourceMap.load(file);
  if (map === null) {
    bytes.set("(no source map)", code.length);

    return bytes;
  }

  const lines = code.split("\n");
  let mapped = 0;
  map.lines.forEach((segments, index) => {
    const lineLength = lines[index]?.length ?? 0;
    segments.forEach((segment, position) => {
      const end = segments[position + 1]?.column ?? lineLength;
      const size = Math.max(0, end - segment.column);
      add(bytes, segment.source === null ? "(generated)" : packageOf(segment.source), size);
      mapped += size;
    });
  });
  add(bytes, "(unmapped)", Math.max(0, code.length - mapped));

  return bytes;
}

function add(
  map: Map<string, number>,
  key: string,
  value: number
): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function kb(
  bytes: number
): string {
  return `${Math.round(bytes / 1024)} KB`;
}

function print(
  title: string,
  map: Map<string, number>
): void {
  console.log(`${title}:`);
  for (const [pkg, bytes] of [...map].sort((a, b) => b[1] - a[1]).slice(0, Number(args.top))) {
    console.log(`  ${kb(bytes).padStart(9)}  ${pkg}`);
  }
}
