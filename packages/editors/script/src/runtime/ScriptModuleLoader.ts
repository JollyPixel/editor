// Import Third-party Dependencies
import type {
  AssetCatalog,
  AssetLoadContext,
  AssetLoader,
  AssetRecord
} from "@jolly-pixel/asset";
import {
  SCRIPT_IMPORTS,
  ScriptImportError,
  isRelativeSpecifier
} from "@jolly-pixel/asset.script/client";
import * as Engine from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  importModule,
  linkModule,
  moduleUrl
} from "../modules/linkModule.ts";
import {
  ModuleRegistry,
  THREE_NAMESPACES
} from "../modules/ModuleRegistry.ts";

// CONSTANTS
const kScriptKind = Engine.SCRIPT_MODULE_ASSET.kind;
const kModules = new ModuleRegistry(SCRIPT_IMPORTS, {
  ...THREE_NAMESPACES,
  "@jolly-pixel/engine": Engine
});

export class ScriptModuleLoader implements AssetLoader<Engine.ScriptModule> {
  #manager: THREE.LoadingManager;
  #urls = new Map<string, Promise<string>>();
  #waits = new Map<string, AssetRecord>();

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<Engine.ScriptModule> {
    return importModule(await this.#url(record, context.assets.catalog));
  }

  #url(
    record: AssetRecord,
    catalog: AssetCatalog
  ): Promise<string> {
    const id = record.id.value;
    let url = this.#urls.get(id);
    if (url === undefined) {
      url = this.#link(record, catalog);
      url.catch(() => this.#urls.delete(id));
      this.#urls.set(id, url);
    }

    return url;
  }

  async #link(
    record: AssetRecord,
    catalog: AssetCatalog
  ): Promise<string> {
    const path = record.path.toString();
    const code = await new THREE.FileLoader(this.#manager).loadAsync(path);
    const linked = await linkModule(
      String(code),
      (specifier) => this.#resolve(record, specifier, catalog)
    );

    return moduleUrl(linked, encodeURI(path));
  }

  async #resolve(
    record: AssetRecord,
    specifier: string,
    catalog: AssetCatalog
  ): Promise<string> {
    if (!isRelativeSpecifier(specifier)) {
      return kModules.url(specifier);
    }

    const dependency = scriptAt(catalog, record, specifier);
    this.#await(record, dependency);
    try {
      return await this.#url(dependency, catalog);
    }
    finally {
      this.#waits.delete(record.id.value);
    }
  }

  #await(
    record: AssetRecord,
    dependency: AssetRecord
  ): void {
    const cycle = [record, dependency];
    let waiting = this.#waits.get(dependency.id.value);
    while (waiting !== undefined) {
      cycle.push(waiting);
      if (waiting.id.equals(record.id)) {
        const paths = cycle.map((script) => `"${script.path}"`).join(" → ");
        throw new ScriptImportError(
          `Scripts import each other: ${paths}. Import a type with "import type".`
        );
      }
      waiting = this.#waits.get(waiting.id.value);
    }
    this.#waits.set(record.id.value, dependency);
  }
}

function scriptAt(
  catalog: AssetCatalog,
  importer: AssetRecord,
  specifier: string
): AssetRecord {
  const target = importer.path.resolve(specifier).toString();
  const candidates = [
    target,
    `${target}.ts`,
    target.replace(/\.js$/, ".ts")
  ];

  for (const candidate of candidates) {
    const record = catalog.findByPath(candidate);
    if (record?.hasKind(kScriptKind)) {
      return record;
    }
  }

  throw new ScriptImportError(
    `"${importer.path}" imports "${specifier}", which is no script of the game.`
  );
}
