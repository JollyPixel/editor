// Import Third-party Dependencies
import * as TSL from "three/tsl";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { ScriptImportPolicy } from "../imports/ScriptImportPolicy.ts";
import { javascriptUrl } from "./linkModule.ts";

// CONSTANTS
const kNamespacesKey = Symbol.for("jolly-pixel.modules");
const kNamespaces = globalNamespaces();

export const THREE_NAMESPACES: Readonly<Record<string, object>> = {
  three: THREE,
  "three/webgpu": THREE,
  "three/tsl": TSL
};

export class ModuleRegistry {
  #policy: ScriptImportPolicy;
  #namespaces: ReadonlyMap<string, object>;
  #urls = new Map<string, string>();

  constructor(
    policy: ScriptImportPolicy,
    namespaces: Readonly<Record<string, object>>
  ) {
    this.#policy = policy;
    this.#namespaces = new Map(
      Array.from(policy.modules, (specifier) => {
        if (!Object.hasOwn(namespaces, specifier)) {
          throw new Error(`No module is provided for "${specifier}".`);
        }

        return [specifier, namespaces[specifier]];
      })
    );
  }

  url(
    specifier: string
  ): string {
    const namespace = this.#namespaces.get(specifier);
    if (namespace === undefined) {
      throw this.#policy.refusal(specifier);
    }

    let url = this.#urls.get(specifier);
    if (url === undefined) {
      url = shimUrl(namespace);
      this.#urls.set(specifier, url);
    }

    return url;
  }
}

function globalNamespaces(): Map<string, object> {
  const existing: unknown = Reflect.get(globalThis, kNamespacesKey);
  if (existing instanceof Map) {
    return existing;
  }

  const namespaces = new Map<string, object>();
  Reflect.set(globalThis, kNamespacesKey, namespaces);

  return namespaces;
}

function shimUrl(
  namespace: object
): string {
  const key = String(kNamespaces.size);
  kNamespaces.set(key, namespace);

  const names = Object.keys(namespace);
  const bindings = names.map((name, index) => `${JSON.stringify(name)}: _${index}`);
  const exported = names.map((name, index) => `_${index} as ${JSON.stringify(name)}`);

  return javascriptUrl([
    `const module = globalThis[Symbol.for("${kNamespacesKey.description}")].get("${key}");`,
    `const { ${bindings.join(", ")} } = module;`,
    `export { ${exported.join(", ")} };`
  ].join("\n"));
}
