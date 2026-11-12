// Import Node.js Dependencies
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import type { GolemTarget } from "../peer/GolemConnectOptions.ts";

// CONSTANTS
export const SCRIPT_OUTPUT_MAX_LENGTH = 8_000;
export const SCRIPT_TIMEOUT_MS = 120_000;

export interface ScriptRunnerOptions {
  target: GolemTarget;
  /**
   * The folder scripts must live in.
   */
  scriptsDir: string;
  /**
   * The script's working directory, where `@jolly-pixel/golem` resolves.
   */
  cwd: string;
}

export interface ScriptRunOptions {
  args?: readonly string[];
  /**
   * @default SCRIPT_TIMEOUT_MS
   */
  timeoutMs?: number;
}

export interface ScriptRun {
  exitCode: number | null;
  timedOut: boolean;
  /**
   * The end of the output when it is longer than `SCRIPT_OUTPUT_MAX_LENGTH`.
   */
  stdout: string;
  stderr: string;
}

export class ScriptRunner {
  readonly scriptsDir: string;

  #target: GolemTarget;
  #cwd: string;

  constructor(
    options: ScriptRunnerOptions
  ) {
    this.scriptsDir = path.resolve(options.scriptsDir);
    this.#target = options.target;
    this.#cwd = options.cwd;
  }

  async run(
    script: string,
    options: ScriptRunOptions = {}
  ): Promise<ScriptRun> {
    const {
      args = [],
      timeoutMs = SCRIPT_TIMEOUT_MS
    } = options;
    const file = path.resolve(this.scriptsDir, script);
    if (!file.startsWith(this.scriptsDir + path.sep)) {
      throw new TypeError(
        `Scripts run from ${this.scriptsDir}; ${JSON.stringify(script)} is outside it.`
      );
    }
    await fs.access(file);

    const child = spawn(process.execPath, [file, ...args], {
      cwd: this.#cwd,
      env: {
        ...process.env,
        JOLLY_STUDIO_URL: this.#target.url.href,
        JOLLY_GOLEM_TOKEN: this.#target.token
      },
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = new OutputTail();
    const stderr = new OutputTail();
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });

    return {
      exitCode,
      timedOut: child.killed,
      stdout: stdout.text(),
      stderr: stderr.text()
    };
  }
}

class OutputTail {
  #text = "";

  push(
    chunk: Buffer
  ): void {
    this.#text = (this.#text + chunk.toString("utf-8"))
      .slice(-SCRIPT_OUTPUT_MAX_LENGTH);
  }

  text(): string {
    return this.#text;
  }
}
