// Import Internal Dependencies
import { BenchmarkError } from "../errors/index.ts";

export function parsePositive(
  label: string,
  raw: string
): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new BenchmarkError(
      `${label} expects a positive number, got "${raw}"`
    );
  }

  return value;
}

export function parseNonNegative(
  label: string,
  raw: string
): number {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(value) || value < 0) {
    throw new BenchmarkError(
      `${label} expects a number >= 0, got "${raw}"`
    );
  }

  return value;
}

export function parseChoice<const TChoice extends string>(
  label: string,
  raw: string,
  choices: readonly TChoice[]
): TChoice {
  const choice = choices.find((candidate) => candidate === raw);
  if (choice === undefined) {
    throw new BenchmarkError(
      `${label} expects one of ${choices.join(", ")}, got "${raw}"`
    );
  }

  return choice;
}
