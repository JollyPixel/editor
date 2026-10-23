export function hashKey(
  key: string
): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash * 31) + key.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}
