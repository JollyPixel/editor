// Import Node.js Dependencies
import { availableParallelism } from "node:os";
import type { ParseArgsOptionsConfig } from "node:util";

// Import Internal Dependencies
import { positiveNumber } from "../utils/parse.ts";

// CONSTANTS
const kDefaultWorkers = Math.max(1, Math.min(4, availableParallelism() - 2));

export const LOAD_ARGS = {
  clients: { type: "string", default: "50" },
  rate: { type: "string", default: "30" },
  duration: { type: "string", default: "10" },
  warmup: { type: "string", default: "2" },
  workers: { type: "string", default: String(kDefaultWorkers) },
  compression: { type: "boolean", default: false },
  profile: { type: "string" },
  json: { type: "boolean", default: false },
  help: { type: "boolean", default: false }
} as const satisfies ParseArgsOptionsConfig;

export interface LoadArgValues {
  clients: string;
  rate: string;
  duration: string;
  warmup: string;
  workers: string;
  compression: boolean;
  profile?: string;
  json: boolean;
  help: boolean;
}

export interface LoadArgs {
  clients: number;
  rate: number;
  durationMs: number;
  warmupMs: number;
  workers: number;
  compression: boolean;
  profile: string | undefined;
  json: boolean;
}

export function loadUsage(
  summary: string,
  options: string
): string {
  return `Usage: pnpm bench:load [options]

${summary}

Options:
${options}
  --clients <n>            connected clients (default 50)
  --rate <hz>              actions per client per second (default 30)
  --duration <s>           measured seconds (default 10)
  --warmup <s>             unmeasured seconds before it (default 2)
  --workers <n>            driver worker threads (default ${kDefaultWorkers})
  --compression            negotiate permessage-deflate
  --profile <dir>          write a server --cpu-prof into this directory
  --json                   print one JSON object instead of a table
  --help                   print this message`;
}

export function readLoadArgs(
  values: LoadArgValues,
  usage: string
): LoadArgs {
  if (values.help) {
    console.log(usage);
    process.exit(0);
  }

  const clients = positiveArg("clients", values.clients);

  return {
    clients,
    rate: positiveArg("rate", values.rate),
    durationMs: positiveArg("duration", values.duration) * 1_000,
    warmupMs: positiveArg("warmup", values.warmup) * 1_000,
    workers: Math.min(clients, positiveArg("workers", values.workers)),
    compression: values.compression,
    profile: values.profile,
    json: values.json
  };
}

export function positiveArg(
  name: string,
  raw: string
): number {
  const value = positiveNumber(raw);
  if (value === null) {
    throw new Error(`--${name} expects a positive number, got "${raw}"`);
  }

  return value;
}

export function nonNegativeArg(
  name: string,
  raw: string
): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${name} expects a number >= 0, got "${raw}"`);
  }

  return value;
}

export function choiceArg<const TChoice extends string>(
  name: string,
  raw: string,
  choices: readonly TChoice[]
): TChoice {
  const choice = choices.find((candidate) => candidate === raw);
  if (choice === undefined) {
    throw new Error(`--${name} expects one of ${choices.join(", ")}`);
  }

  return choice;
}
