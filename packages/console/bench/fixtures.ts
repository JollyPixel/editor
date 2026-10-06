// Import Internal Dependencies
import { CommandConsole } from "../src/CommandConsole.ts";

// CONSTANTS
const kWords = [
  "brush",
  "size",
  "mode",
  "axis",
  "pattern",
  "rotation",
  "ghost",
  "layer",
  "tileset",
  "camera",
  "snap",
  "grid",
  "undo",
  "redo",
  "select",
  "fill",
  "export",
  "preview",
  "palette",
  "zoom"
];

export interface PopulateOptions {
  namespaces: number;
  entriesPerNamespace: number;
}

export function populate(
  rng: () => number,
  options: PopulateOptions
): CommandConsole {
  const commands = new CommandConsole();
  for (let index = 0; index < options.namespaces; index++) {
    const namespace = commands.registerNamespace(`ns${index}`, {
      description: sentence(rng)
    });
    for (let entry = 0; entry < options.entriesPerNamespace / 2; entry++) {
      namespace.registerVariable(`var${entry}${word(rng)}`, {
        type: "number",
        description: sentence(rng),
        get: () => entry,
        set: () => undefined
      });
      namespace.registerCommand(`cmd${entry}${word(rng)}`, {
        description: sentence(rng),
        args: [],
        execute: () => undefined
      });
    }
  }

  return commands;
}

export function sentence(
  rng: () => number,
  length = 5
): string {
  return Array.from({ length }, () => word(rng)).join(" ");
}

function word(
  rng: () => number
): string {
  return kWords[Math.floor(rng() * kWords.length)];
}
