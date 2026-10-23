// Import Third-party Dependencies
import {
  readJsonFile,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import type { BackupEntry } from "#src/storage/AssetBackups.ts";
import { text } from "./bytes.ts";

// CONSTANTS
export const BACKUP_LEDGER = ".jollypixel/objects/index.json";

export async function readBackups(
  source: AssetSource
): Promise<BackupEntry[]> {
  const ledger = await readJsonFile(source, BACKUP_LEDGER) as {
    entries: BackupEntry[];
  } | null;

  return ledger?.entries ?? [];
}

export async function readObject(
  source: AssetSource,
  hash: string
): Promise<string> {
  return text(
    await source.read(`.jollypixel/objects/${hash.slice(0, 2)}/${hash.slice(2)}`)
  );
}

export function failObjectWrites(
  source: AssetSource
): Disposable {
  const writeIfAbsent = source.writeIfAbsent.bind(source);
  source.writeIfAbsent = async(path, data) => {
    if (path.startsWith(".jollypixel/objects/")) {
      throw new Error("disk full");
    }

    return writeIfAbsent(path, data);
  };

  return {
    [Symbol.dispose]() {
      source.writeIfAbsent = writeIfAbsent;
    }
  };
}
