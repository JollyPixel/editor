// CONSTANTS
const kImporters = "importers:";
const kResolutionSections = new Set([
  "packages:",
  "snapshots:"
]);
const kEntry = /^ {2}(?! )('[^']*'|"[^"]*"|[^:]+):(.*)$/;

export class PnpmLockfile {
  readonly #blocks: Map<string, string>;

  static parse(
    text: string
  ): PnpmLockfile {
    const blocks = new Map<string, string>();
    let documentIndex = 0;
    let section = "";
    let key: string | null = null;

    for (const line of text.split(/\r?\n/)) {
      if (line.trim() === "") {
        continue;
      }
      if (line === "---") {
        documentIndex++;
        section = "";
        key = null;
        continue;
      }

      const entry = kEntry.exec(line);
      if (/^\S/.test(line)) {
        section = line;
        key = [documentIndex, section, ""].join("\n");
        blocks.set(key, "");
      }
      else if (entry !== null) {
        key = [documentIndex, section, entry[1]].join("\n");
        blocks.set(key, entry[2]);
      }
      else if (key !== null) {
        blocks.set(key, `${blocks.get(key)}\n${line}`);
      }
    }

    return new PnpmLockfile(blocks);
  }

  constructor(
    blocks: Map<string, string>
  ) {
    this.#blocks = new Map(blocks);
  }

  importersChangedSince(
    base: PnpmLockfile
  ): Set<string> | null {
    const importers = new Set<string>();
    const keys = new Set([
      ...this.#blocks.keys(),
      ...base.#blocks.keys()
    ]);

    for (const key of keys) {
      const current = this.#blocks.get(key);
      const previous = base.#blocks.get(key);
      if (current === previous) {
        continue;
      }

      const [, section, name] = key.split("\n");
      if (section === kImporters && name !== "" && name !== ".") {
        if (current !== undefined) {
          importers.add(name);
        }
      }
      else if (
        !kResolutionSections.has(section) ||
        name === "" ||
        (current !== undefined && previous !== undefined)
      ) {
        return null;
      }
    }

    return importers;
  }
}
