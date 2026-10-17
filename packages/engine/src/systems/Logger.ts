// Import Third-party Dependencies
import pm from "picomatch";

// Import Internal Dependencies
import type { ConsoleAdapter } from "../adapters/console.ts";

export type LogLevel = "void" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";
type EmittedLogLevel = Exclude<LogLevel, "void">;

// CONSTANTS
const kLogLevelValue: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  void: Infinity
};
const kAdapterMethod: Record<EmittedLogLevel, keyof ConsoleAdapter> = {
  trace: "log",
  debug: "log",
  info: "log",
  warn: "warn",
  error: "error",
  fatal: "error"
};
const kPrivateToken = Symbol("LoggerPrivate");

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

interface LoggerPrivateOptions {
  token: typeof kPrivateToken;
  namespace: string;
  root: LoggerState;
}

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

  setLevel(
    level: LogLevel
  ): void {
    this.#root.level = level;
  }

  enableNamespace(
    ...patterns: string[]
  ): void {
    this.#root.namespaces.push(...patterns);
    this.#root.invalidateMatchers();
  }

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

  isLevelEnabled(
    level: LogLevel
  ): boolean {
    return kLogLevelValue[level] >= kLogLevelValue[this.#root.level];
  }

  isNamespaceEnabled(): boolean {
    return this.#root.isNamespaceEnabled(this.namespace);
  }

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
    this.#emit("trace", msg, meta);
  }

  debug(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    this.#emit("debug", msg, meta);
  }

  info(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    this.#emit("info", msg, meta);
  }

  warn(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    this.#emit("warn", msg, meta);
  }

  error(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    this.#emit("error", msg, meta);
  }

  fatal(
    msg: string,
    meta?: Record<string, unknown>
  ): void {
    this.#emit("fatal", msg, meta);
  }

  async step<T>(
    name: string,
    run: () => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const startedAt = performance.now();
    this.debug(`${name} started`, meta);

    try {
      const result = await run();
      const endedAt = performance.now();
      performance.measure(`${this.#label}:${name}`, {
        start: startedAt,
        end: endedAt
      });
      this.debug(`${name} done`, {
        ...meta,
        ms: Math.round(endedAt - startedAt)
      });

      return result;
    }
    catch (error) {
      this.error(`${name} failed`, {
        ...meta,
        error
      });

      throw error;
    }
  }

  get #label(): string {
    return this.namespace || "root";
  }

  #emit(
    level: EmittedLogLevel,
    msg: string,
    meta: Record<string, unknown> | undefined
  ): void {
    if (
      !this.isLevelEnabled(level) ||
      !this.isNamespaceEnabled()
    ) {
      return;
    }

    const formatted = `[${level.toUpperCase()}] [${this.#label}] ${msg}`;
    const args = meta === undefined ? [formatted] : [formatted, meta];

    this.#root.adapter[kAdapterMethod[level]](...args);
  }
}

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
