// Import Internal Dependencies
import type {
  ConsoleRegistry,
  RegisteredCommand,
  RegisteredNamespace,
  RegisteredVariable
} from "./types.ts";

export class ScopedRegistry implements ConsoleRegistry {
  readonly scope: RegisteredNamespace;

  #registry: ConsoleRegistry;

  constructor(
    registry: ConsoleRegistry,
    scope: RegisteredNamespace
  ) {
    this.#registry = registry;
    this.scope = scope;
  }

  get root(): RegisteredNamespace {
    return this.#registry.root;
  }

  namespace(
    address: string
  ): RegisteredNamespace | undefined {
    return this.#scopedFirst(
      address,
      (candidate) => this.#registry.namespace(candidate)
    );
  }

  namespaces(): IterableIterator<RegisteredNamespace> {
    return this.#registry.namespaces();
  }

  children(
    namespace: RegisteredNamespace
  ): IterableIterator<RegisteredNamespace> {
    return this.#registry.children(namespace);
  }

  [Symbol.iterator](): IterableIterator<RegisteredNamespace> {
    return this.#registry[Symbol.iterator]();
  }

  resolveCommand(
    address: string
  ): RegisteredCommand | undefined {
    return this.#scopedFirst(
      address,
      (candidate) => this.#registry.resolveCommand(candidate)
    );
  }

  resolveVariable(
    address: string
  ): RegisteredVariable | undefined {
    return this.#scopedFirst(
      address,
      (candidate) => this.#registry.resolveVariable(candidate)
    );
  }

  #scopedFirst<T>(
    address: string,
    find: (address: string) => T | undefined
  ): T | undefined {
    const scope = this.scope.address;
    const scoped = scope === "" || address === "" ?
      undefined :
      find(`${scope}.${address}`);

    return scoped ?? find(address);
  }
}
