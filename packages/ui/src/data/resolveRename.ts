export function resolveRename(
  currentLabel: string,
  draft: string
): string | null {
  const name = draft.trim();
  if (
    name === "" ||
    name === currentLabel
  ) {
    return null;
  }

  return name;
}
