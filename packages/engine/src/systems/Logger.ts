// Import Third-party Dependencies
import pm from "picomatch";

// Import Internal Dependencies
import type { ConsoleAdapter } from "../adapters/console.ts";

export type LogLevel = "void" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";

// CONSTANTS
export const kLogLevelValue: Record<LogLevel, number> = {
  void: 0,
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

export interface LoggerOptions {
  /**
   * Minimum severity level to emit. Messages below this level are silently dropped.
   * Default: "info"
   */
  level?: LogLevel;
  /**
   * Namespace glob patterns to enable. Uses dot-notation with wildcard support:
   *   "systems.*"        → matches systems, systems.sceneManager, systems.asset.queue, ...
   *   "systems.asset.*"  → matches systems.asset, systems.asset.registry, ...
   *   "*"                → matches all namespaces (equivalent to debug mode)
   *
   * Default: [] (nothing is logged)
   */
  namespaces?: string[];
  /**
   * Output adapter. Defaults to the global `console`.
   */
  adapter?: ConsoleAdapter;
}

export interface LoggerChildOptions {
  namespace: string;
}

// CONSTANTS
const kPrivateToken = Symbol("LoggerPrivate");

interface LoggerPrivateOptions {
  token: typeof kPrivateToken;
  namespace: string;
  root: LoggerState;
}

/**
 * Holds the shared mutable state of a logger tree.
 * All child loggers created via `.child()` reference the same LoggerState,
 * so runtime changes to level or namespaces propagate immediately.
 */
class LoggerState {
  level: LogLevel;
  namespaces: string[];
  adapter: ConsoleAdapter;

  #matchers: Map<string, (str: string) => boolean> = new Map();

  constructor(
    options: LoggerOptions
  ) {
    const {
      level = "info",
      namespaces = [],
      adapter = console
    } = options;

    this.level = level;
    this.namespaces = structuredClone(namespaces);
    this.adapter = adapter;
  }

  invalidateMatchers(): void {
    this.#matchers.clear();
  }

  isNamespaceEnabled(
    namespace: string
  ): boolean {
    if (this.namespaces.length === 0) {
      return false;
    }

    const normalized = normalizeNamespace(namespace);

    for (const pattern of this.namespaces) {
      let matcher = this.#matchers.get(pattern);

      if (!matcher) {
        matcher = pm(normalizePattern(pattern));
        this.#matchers.set(pattern, matcher);
      }

      if (normalized === "" || matcher(normalized)) {
        return true;
      }
    }

    return false;
  }
}

export class Logger {
  readonly #root: LoggerState;
  readonly namespace: string;

  constructor(options?: LoggerOptions);
  constructor(options: LoggerPrivateOptions);
  constructor(options: LoggerOptions | LoggerPrivateOptions = {}) {
    if ("token" in options && options.token === kPrivateToken) {
      this.namespace = options.namespace;
      this.#root = options.root;
    }
    else {
      this.namespace = "";
      this.#root = new LoggerState(options as LoggerOptions);
    }
  }

  get level(): LogLevel {
    return this.#root.level;
  }

  /**
   * Changes the minimum log level for the entire logger tree.
   * Affects all child loggers immediately since they share the same state.
   */
  setLevel(
    level: LogLevel
  ): void {
    this.#root.level = level;
  }

  /**
   * Adds one or more namespace patterns to the enabled set.
   * Invalidates the matcher cache so new patterns take effect immediately.
   *
   * @example
   * logger.enableNamespace("systems.*", "actor");
   */
  enableNamespace(
    ...patterns: string[]
  ): void {
    this.#root.namespaces.push(...patterns);
    this.#root.invalidateMatchers();
  }

  /**
   * Removes one or more namespace patterns from the enabled set.
   */
  disableNamespace(
    ...patterns: string[]
  ): void {
    for (const pattern of patterns) {
      const index = this.#root.namespaces.indexOf(pattern);

      if (index !== -1) {
        this.#root.namespaces.splice(index, 1);
      }
    }
    this.#root.invalidateMatchers();
  }

  /**
   * Returns true if the given level would be emitted given the current minimum level.
   */
  isLevelEnabled(
    level: LogLevel
  ): boolean {
    return kLogLevelValue[level] >= kLogLevelValue[this.#root.level];
  }

  /**
   * Returns true if this logger's own namespace is currently enabled.
   */
  isNamespaceEnabled(): boolean {
    return this.#root.isNamespaceEnabled(this.namespace);
  }

  /**
   * Creates a child logger whose namespace is appended to this logger's namespace.
   * The child shares the same level, namespace list, and adapter as the root.
   *
   * @example
   * const root = new Logger({ level: "debug", namespaces: ["systems.*"] });
   * const child = root.child({ namespace: "systems.sceneManager" });
   * child.debug("setScene", { scene: "Game" });
   * // → [DEBUG] [systems.sceneManager] setScene
   */
  child(
    options: LoggerChildOptions
  ): Logger {
    const ns = this.namespace
      ? `${this.namespace}.${options.namespace}`
      : options.namespace;

    return new Logger({
      token: kPrivateToken,
      namespace: ns,
      root: this.#root
    });
  }

  trace(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.#root.level === "void") {
      return;
    }

    this.#emit("trace", msg, meta);
  }

  debug(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.#root.level === "void") {
      return;
    }

    this.#emit("debug", msg, meta);
  }

  info(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.#root.level === "void") {
      return;
    }

    this.#emit("info", msg, meta);
  }

  warn(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.#root.level === "void") {
      return;
    }

    this.#emit("warn", msg, meta);
  }

  error(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.#root.level === "void") {
      return;
    }

    this.#emit("error", msg, meta);
  }

  fatal(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.#root.level === "void") {
      return;
    }

    this.#emit("fatal", msg, meta);
  }

  #emit(
    level: LogLevel,
    msg: string,
    meta: Record<string, unknown> | undefined
  ): void {
    if (this.#root.level === "void") {
      return;
    }

    if (
      !this.isLevelEnabled(level) ||
      !this.isNamespaceEnabled()
    ) {
      return;
    }

    const ns = this.namespace || "root";
    const formatted = `[${level.toUpperCase()}] [${ns}] ${msg}`;

    if (level === "warn") {
      if (meta === undefined) {
        this.#root.adapter.warn(formatted);
      }
      else {
        this.#root.adapter.warn(formatted, meta);
      }
    }
    else if (level === "error" || level === "fatal") {
      if (meta === undefined) {
        this.#root.adapter.error(formatted);
      }
      else {
        this.#root.adapter.error(formatted, meta);
      }
    }
    else if (meta === undefined) {
      this.#root.adapter.log(formatted);
    }
    else {
      this.#root.adapter.log(formatted, meta);
    }
  }
}

/**
 * Converts a dot-notation namespace pattern into a slash-separated glob
 * compatible with picomatch.
 *
 * @example
 * "systems.*"       → "systems/**"
 * "systems.asset.*" → "systems/asset/**"
 * "*"               → "**"
 * "systems"         → "systems"
 */
function normalizePattern(
  pattern: string
): string {
  const normalized = pattern.replaceAll(".", "/");

  if (normalized === "*") {
    return "**";
  }

  if (normalized.endsWith("/*")) {
    return `${normalized.slice(0, -1)}**`;
  }

  return normalized;
}

function normalizeNamespace(
  namespace: string
): string {
  return namespace.replaceAll(".", "/");
}
