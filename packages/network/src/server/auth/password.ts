// Import Node.js Dependencies
import {
  randomBytes,
  scrypt,
  timingSafeEqual
} from "node:crypto";

// CONSTANTS
const kSaltLength = 16;
const kDerivedKeyLength = 32;
const kScryptOptions = {
  N: 32_768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024
};

export interface PasswordHash {
  digest: Buffer;
  salt: Buffer;
}

function digestOf(
  value: string,
  salt: Buffer
): Promise<Buffer> {
  const {
    promise,
    resolve,
    reject
  } = Promise.withResolvers<Buffer>();

  scrypt(
    value,
    salt,
    kDerivedKeyLength,
    kScryptOptions,
    (error, digest) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(digest);
    }
  );

  return promise;
}

export async function hashPassword(
  password: string
): Promise<PasswordHash> {
  const salt = randomBytes(kSaltLength);
  const digest = await digestOf(
    password,
    salt
  );

  return {
    digest,
    salt
  };
}

export async function verifyPassword(
  password: string,
  hash: PasswordHash
): Promise<boolean> {
  const digest = await digestOf(
    password,
    hash.salt
  );

  return timingSafeEqual(
    digest,
    hash.digest
  );
}
