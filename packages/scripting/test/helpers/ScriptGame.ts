// Import Node.js Dependencies
import {
  after,
  before
} from "node:test";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference
} from "@jolly-pixel/asset";
import {
  SCRIPT_MODULE_ASSET,
  type ScriptModule
} from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ScriptModuleLoader } from "#src/runtime/ScriptModuleLoader.ts";

export interface ScriptGame {
  load(path: string): Promise<ScriptModule>;
}

class FakeProgressEvent extends Event {
  readonly lengthComputable = false;
  readonly loaded = 0;
  readonly total = 0;
}

export function fakeProgressEvents(): void {
  const previous = globalThis.ProgressEvent;
  before(() => {
    globalThis.ProgressEvent = FakeProgressEvent;
  });
  after(() => {
    globalThis.ProgressEvent = previous;
  });
}

export function scriptGame(
  scripts: Readonly<Record<string, string>>
): ScriptGame {
  const records = Object.keys(scripts).map((path, index) => new AssetRecord({
    id: `script-${index}`,
    kind: "script",
    path
  }));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (
    Object.hasOwn(scripts, url) ?
      `data:text/javascript,${encodeURIComponent(scripts[url])}` :
      url
  ));
  const coordinator = new AssetCoordinator({
    catalog: new AssetCatalog(records),
    loaders: new AssetLoaderRegistry()
      .register(SCRIPT_MODULE_ASSET, new ScriptModuleLoader(manager))
  });

  return {
    load(path) {
      const record = records.find((script) => script.path.toString() === path)!;

      return coordinator.load(new AssetReference(record.id, SCRIPT_MODULE_ASSET));
    }
  };
}
