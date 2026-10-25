// CONSTANTS
const kAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const kIdLength = 12;
const kUnbiasedLimit = 256 - (256 % kAlphabet.length);

export function randomId(): string {
  let id = "";
  while (id.length < kIdLength) {
    for (const byte of crypto.getRandomValues(new Uint8Array(kIdLength))) {
      if (byte < kUnbiasedLimit && id.length < kIdLength) {
        id += kAlphabet[byte % kAlphabet.length];
      }
    }
  }

  return id;
}
