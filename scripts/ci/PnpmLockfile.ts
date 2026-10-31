// CONSTANTS
const kImporters = "importers:";
const kResolutionSections = new Set([
  "packages:",
  "snapshots:"
]);
const kEntry = /^ {2}(?! )('[^']*'|"[^"]*"|[^:]+):(.*)$/;
const kImporterPath = /^[\w./@-]+$/;

interface LockfileEntry {
  document: number;
  section: string;
  name: string;
  body: string;
}

export class PnpmLockfile {
  static parse(
    text: string
  ): PnpmLockfile {
    const entries: LockfileEntry[] = [];
    let document = 0;
    let section = "";
    let current: LockfileEntry | null = null;

    for (const line of text.split(/\r?\n/)) {
      if (line.trim() === "") {
        continue;
      }
      if (line === "---") {
        document++;
        section = "";
        current = null;
        continue;
      }

      const entry = kEntry.exec(line);
      if (/^\S/.test(line)) {
        section = line;
        current = {
          document,
          section,
          name: "",
          body: ""
        };
        entries.push(current);
      }
      else if (entry !== null) {
        current = {
          document,
          section,
          name: entry[1],
          body: entry[2]
        };
        entries.push(current);
      }
      else if (current !== null) {
        current.body += `\n${line}`;
      }
    }

    return new PnpmLockfile(entries);
  }

  readonly #entries = new Map<string, LockfileEntry>();

  constructor(
    entries: Iterable<LockfileEntry>
  ) {
    for (const entry of entries) {
      this.#entries.set(`${entry.document}\n${entry.section}\n${entry.name}`, entry);
    }
  }

  importersChangedSince(
    base: PnpmLockfile
  ): Set<string> | null {
    const importers = new Set<string>();
    const keys = new Set([
      ...this.#entries.keys(),
      ...base.#entries.keys()
    ]);

    for (const key of keys) {
      const current = this.#entries.get(key);
      const previous = base.#entries.get(key);
      const entry = current ?? previous;
      if (entry === undefined || current?.body === previous?.body) {
        continue;
      }

      const { section, name } = entry;
      if (section === kImporters && name !== "" && name !== ".") {
        if (!kImporterPath.test(name)) {
          return null;
        }
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
