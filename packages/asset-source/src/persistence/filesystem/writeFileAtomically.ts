// Import Node.js Dependencies
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function writeFileAtomically(
  absolute: string,
  data: Uint8Array
): Promise<void> {
  const directory = path.dirname(absolute);
  await fs.mkdir(
    directory,
    { recursive: true }
  );

  const temporary = path.join(
    directory,
    `.${path.basename(absolute)}.${randomBytes(6).toString("hex")}.tmp`
  );
  try {
    await fs.writeFile(temporary, data);
    await fs.rename(temporary, absolute);
  }
  catch (error) {
    await fs.rm(
      temporary,
      { force: true }
    );
    throw error;
  }
}
