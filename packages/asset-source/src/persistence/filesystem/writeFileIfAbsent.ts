// Import Node.js Dependencies
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function writeFileIfAbsent(
  absolute: string,
  data: Uint8Array
): Promise<boolean> {
  const directory = path.dirname(absolute);
  await fs.mkdir(
    directory,
    { recursive: true }
  );

  const temporary = path.join(
    directory,
    `.${path.basename(absolute)}.${randomBytes(6).toString("hex")}.tmp`
  );
  let ownsTemporary = false;
  try {
    const file = await fs.open(temporary, "wx");
    ownsTemporary = true;
    try {
      await file.writeFile(data);
    }
    finally {
      await file.close();
    }

    try {
      await fs.link(temporary, absolute);

      return true;
    }
    catch (error) {
      if (isAlreadyExists(error)) {
        return false;
      }
      throw error;
    }
  }
  finally {
    if (ownsTemporary) {
      await fs.rm(
        temporary,
        { force: true }
      );
    }
  }
}

function isAlreadyExists(
  error: unknown
): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST";
}
