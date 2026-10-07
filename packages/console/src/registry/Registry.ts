// Import Internal Dependencies
import {
  ancestorAddresses,
  parentAddress
} from "./address.ts";
import { NamespaceEntry } from "./NamespaceEntry.ts";
import type {
  ConsoleNamespace,
  ConsoleRegistry,
  NamespaceMeta,
  RegisteredCommand,
  RegisteredNamespace,
  RegisteredVariable
} from "./types.ts";
import { assertNamespacePath } from "./validation.ts";

export class Registry implements ConsoleRegistry {
  readonly root: NamespaceEntry;

  #registered = new Map<string, NamespaceEntry>();
  #namespaces: Map<string, NamespaceEntry> | null = null;
  #onChange: () => void;

  constructor(
    onChange: () => void
  ) {
    this.#onChange = onChange;
    this.root = new NamespaceEntry({
      address: "",
      onChange
    });
  }

  get scope(): RegisteredNamespace {
    return this.root;
  }

  namespace(
    address: string
  ): NamespaceEntry | undefined {
    return this.#all().get(address.toLowerCase());
  }

  namespaces(): IterableIterator<NamespaceEntry> {
    return this.#all().values();
  }

  * children(
    namespace: RegisteredNamespace
  ): IterableIterator<NamespaceEntry> {
    const parent = namespace.address.toLowerCase();
    for (const entry of this.#all().values()) {
      if (parentAddress(entry.address).toLowerCase() === parent) {
        yield entry;
      }
    }
  }

  * [Symbol.iterator](): IterableIterator<NamespaceEntry> {
    yield this.root;
    yield* this.#all().values();
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
    address: string,
    meta: NamespaceMeta = {}
  ): ConsoleNamespace {
    assertNamespacePath(address);

    const key = address.toLowerCase();
    this.#registered.get(key)?.clear();
    const entry = new NamespaceEntry({
      address,
      description: meta.description,
      onChange: this.#onChange
    });
    this.#registered.set(key, entry);
    this.#namespacesChanged();

    return {
      registerCommand: (member, def) => entry.registerCommand(member, def),
      registerVariable: (member, def) => entry.registerVariable(member, def),
      unregister: () => {
        if (this.#registered.get(key) !== entry) {
          return;
        }
        this.#registered.delete(key);
        entry.clear();
        this.#namespacesChanged();
      }
    };
  }

  clear(): void {
    this.root.clear();
    for (const namespace of this.#registered.values()) {
      namespace.clear();
    }
    this.#registered.clear();
    this.#namespacesChanged();
  }

  #namespacesChanged(): void {
    this.#namespaces = null;
    this.#onChange();
  }

  #all(): Map<string, NamespaceEntry> {
    if (this.#namespaces !== null) {
      return this.#namespaces;
    }

    const all = new Map<string, NamespaceEntry>();
    for (const [key, entry] of this.#registered) {
      for (const ancestor of ancestorAddresses(entry.address)) {
        const ancestorKey = ancestor.toLowerCase();
        if (!all.has(ancestorKey)) {
          all.set(
            ancestorKey,
            this.#registered.get(ancestorKey) ?? new NamespaceEntry({
              address: ancestor,
              implicit: true,
              onChange: this.#onChange
            })
          );
        }
      }
      all.set(key, entry);
    }
    this.#namespaces = all;

    return all;
  }

  #split(
    address: string
  ): [NamespaceEntry | undefined, string] {
    const dot = address.lastIndexOf(".");
    if (dot === -1) {
      return [this.root, address];
    }

    return [
      this.namespace(address.slice(0, dot)),
      address.slice(dot + 1)
    ];
  }
}
