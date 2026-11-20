// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import ts from "typescript";

// Import Internal Dependencies
import {
  SCRIPT_IMPORTS,
  SHADER_IMPORTS
} from "../dist/index.js";
import {
  LIB_DIRECTORY,
  NODE_MODULES_DIRECTORY,
  SCRIPT_COMPILER_OPTIONS
} from "../dist/language/compilerOptions.js";

// CONSTANTS
const kPackageDir = path.join(import.meta.dirname, "..");
const kOutDir = path.join(kPackageDir, "dist", "types");
const kImporter = path.join(kPackageDir, "script.ts");

const modules = new Set([
  ...SCRIPT_IMPORTS.modules,
  ...SHADER_IMPORTS.modules
]);
const host = ts.createCompilerHost(SCRIPT_COMPILER_OPTIONS);
const libDirectory = path.dirname(ts.getDefaultLibFilePath(SCRIPT_COMPILER_OPTIONS));
const importer = Array.from(modules, (name) => `import "${name}";`).join("\n");
const program = ts.createProgram({
  rootNames: [kImporter],
  options: {
    ...SCRIPT_COMPILER_OPTIONS,
    lib: SCRIPT_COMPILER_OPTIONS.lib?.map((lib) => path.join(libDirectory, lib))
  },
  host: {
    ...host,
    fileExists: (file) => isImporter(file) || host.fileExists(file),
    readFile: (file) => (isImporter(file) ? importer : host.readFile(file)),
    getSourceFile: (file, ...rest) => (isImporter(file) ?
      ts.createSourceFile(file, importer, ts.ScriptTarget.Latest) :
      host.getSourceFile(file, ...rest))
  }
});

const missing = program.getSemanticDiagnostics(program.getSourceFile(kImporter));
if (missing.length > 0) {
  throw new Error(ts.formatDiagnostics(missing, host));
}

const files = new Map<string, string>();
for (const source of program.getSourceFiles()) {
  if (isImporter(source.fileName)) {
    continue;
  }

  for (const [file, text] of virtualFiles(source)) {
    files.set(file, text);
  }
}

fs.mkdirSync(kOutDir, { recursive: true });
fs.writeFileSync(
  path.join(kOutDir, "scriptTypes.js"),
  `export default JSON.parse(${JSON.stringify(JSON.stringify(Object.fromEntries(files)))});\n`
);
fs.writeFileSync(
  path.join(kOutDir, "scriptTypes.d.ts"),
  [
    "import type { ScriptTypeFiles } from \"../language/ScriptLanguageService.ts\";",
    "declare const files: ScriptTypeFiles;",
    "export default files;",
    ""
  ].join("\n")
);

function isImporter(
  file: string
): boolean {
  return path.resolve(file) === kImporter;
}

function virtualFiles(
  source: ts.SourceFile
): Array<[string, string]> {
  const real = path.resolve(source.fileName);
  if (path.dirname(real) === path.resolve(libDirectory)) {
    return [
      [`${LIB_DIRECTORY}/${path.basename(real)}`, source.text]
    ];
  }

  for (let dir = path.dirname(real); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const manifest = path.join(dir, "package.json");
    if (!fs.existsSync(manifest)) {
      continue;
    }
    const text = fs.readFileSync(manifest, "utf-8");
    const { name } = JSON.parse(text) as { name?: string; };
    if (name === undefined) {
      continue;
    }
    const root = `${NODE_MODULES_DIRECTORY}/${name}`;

    return [
      [`${root}/${path.relative(dir, real).replaceAll("\\", "/")}`, source.text],
      [`${root}/package.json`, text]
    ];
  }

  return [];
}
