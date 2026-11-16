// Import Internal Dependencies
import { createEnvironmentFile } from "../asset/environment.ts";
import type {
  EnvironmentChange,
  EnvironmentCommand,
  EnvironmentFile,
  EnvironmentSection
} from "../network/types.ts";

export class EnvironmentState {
  #file: EnvironmentFile = createEnvironmentFile();

  get file(): Readonly<EnvironmentFile> {
    return this.#file;
  }

  load(
    file: Readonly<EnvironmentFile>
  ): void {
    this.#file = structuredClone(file);
  }

  clear(): void {
    this.#file = createEnvironmentFile();
  }

  applyCommand(
    command: EnvironmentCommand
  ): void {
    this.#file = {
      ...this.#file,
      ...structuredClone(command.set)
    };
  }

  current(
    change: EnvironmentChange
  ): EnvironmentChange {
    return Object.fromEntries(
      changedSections(change).map((section) => [
        section,
        structuredClone(this.#file[section])
      ])
    );
  }

  snapshot(): EnvironmentFile {
    return structuredClone(this.#file);
  }
}

export function environmentWriteKeys(
  command: EnvironmentCommand
): readonly string[] {
  return changedSections(command.set);
}

export function changedSections(
  change: EnvironmentChange
): EnvironmentSection[] {
  return Object.keys(change) as EnvironmentSection[];
}
