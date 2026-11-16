// Import Third-party Dependencies
import * as TSL from "three/tsl";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { SHADER_IMPORTS } from "../imports/importPolicies.ts";
import { javascriptUrl } from "../modules/linkModule.ts";

// CONSTANTS
const kNamespacesKey = Symbol.for("jolly-pixel.modules");
const kShaderNamespaces = new Map<string, object>([
  ["three", THREE],
  ["three/webgpu", THREE],
  ["three/tsl", TSL]
]);
const kUrls = new Map<object, string>();

export function shaderModuleUrl(
  specifier: string
): string {
  const namespace = kShaderNamespaces.get(specifier);
  if (namespace === undefined) {
    throw SHADER_IMPORTS.refusal(specifier);
  }

  let url = kUrls.get(namespace);
  if (url === undefined) {
    url = shimUrl(namespace);
    kUrls.set(namespace, url);
  }

  return url;
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
  const namespaces = globalNamespaces();
  const key = String(namespaces.size);
  namespaces.set(key, namespace);

  const names = Object.keys(namespace);
  const bindings = names.map((name, index) => `${JSON.stringify(name)}: _${index}`);
  const exported = names.map((name, index) => `_${index} as ${JSON.stringify(name)}`);

  return javascriptUrl([
    `const module = globalThis[Symbol.for("${kNamespacesKey.description}")].get("${key}");`,
    `const { ${bindings.join(", ")} } = module;`,
    `export { ${exported.join(", ")} };`
  ].join("\n"));
}
