// Import Internal Dependencies
import { NamespaceEntry } from "./NamespaceEntry.ts";
import type {
  ConsoleNamespace,
  ConsoleRegistry,
  NamespaceMeta,
  RegisteredCommand,
  RegisteredVariable
} from "./types.ts";
import { assertIdentifier } from "./validation.ts";

export class Registry implements ConsoleRegistry {
  readonly root: NamespaceEntry;

  #namespaces = new Map<string, NamespaceEntry>();
  #onChange: () => void;

  constructor(
    onChange: () => void
  ) {
    this.#onChange = onChange;
    this.root = new NamespaceEntry({
      name: "",
      onChange
    });
  }

  namespace(
    name: string
  ): NamespaceEntry | undefined {
    return this.#namespaces.get(name.toLowerCase());
  }

  namespaces(): IterableIterator<NamespaceEntry> {
    return this.#namespaces.values();
  }

  resolveCommand(
    address: string
  ): RegisteredCommand | undefined {
    const [scope, member] = this.#split(address);

    return scope?.command(member);
  }

  resolveVariable(
    address: string
  ): RegisteredVariable | undefined {
    const [scope, member] = this.#split(address);

    return scope?.variable(member);
  }

  registerNamespace(
    name: string,
    meta: NamespaceMeta = {}
  ): ConsoleNamespace {
    assertIdentifier(name);

    const key = name.toLowerCase();
    this.#namespaces.get(key)?.clear();
    const entry = new NamespaceEntry({
      name,
      description: meta.description,
      onChange: this.#onChange
    });
    this.#namespaces.set(key, entry);
    this.#onChange();

    return {
      registerCommand: (member, def) => entry.registerCommand(member, def),
      registerVariable: (member, def) => entry.registerVariable(member, def),
      unregister: () => {
        if (this.#namespaces.get(key) !== entry) {
          return;
        }
        this.#namespaces.delete(key);
        entry.clear();
        this.#onChange();
      }
    };
  }

  clear(): void {
    this.root.clear();
    for (const namespace of this.#namespaces.values()) {
      namespace.clear();
    }
    this.#namespaces.clear();
    this.#onChange();
  }

  #split(
    address: string
  ): [NamespaceEntry | undefined, string] {
    const parts = address.split(".");
    if (parts.length === 1) {
      return [this.root, address];
    }
    if (parts.length === 2) {
      return [this.namespace(parts[0]), parts[1]];
    }

    return [undefined, ""];
  }
}
