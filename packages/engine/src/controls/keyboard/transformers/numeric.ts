// CONSTANTS
const kNumeric = new Set("0123456789".split(""));

export type Numeric = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export const NUMERIC_TO_KEY = {
  0: "Digit0",
  1: "Digit1",
  2: "Digit2",
  3: "Digit3",
  4: "Digit4",
  5: "Digit5",
  6: "Digit6",
  7: "Digit7",
  8: "Digit8",
  9: "Digit9"
} as const;

export function isNumeric(char: string): char is Numeric {
  return kNumeric.has(char);
}
