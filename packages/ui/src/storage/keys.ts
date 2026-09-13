// CONSTANTS
const kCombiningMarks = /[̀-ͯ]/g;
const kNonAlphanumeric = /[^a-z0-9]+/g;
const kEdgeSeparators = /^-+|-+$/g;

export function slugify(
  label: string
): string {
  return label
    .normalize("NFD")
    .replace(kCombiningMarks, "")
    .toLowerCase()
    .replace(kNonAlphanumeric, "-")
    .replace(kEdgeSeparators, "");
}

export function deriveKey(
  tagName: string,
  label: string,
  occurrence = 1
): string {
  const slug = slugify(label);
  const base = slug === "" ?
    tagName.toLowerCase() :
    `${tagName.toLowerCase()}:${slug}`;

  return occurrence > 1 ? `${base}#${occurrence}` : base;
}

export function resolveOrder(
  stored: readonly string[],
  present: readonly string[]
): string[] {
  const presentKeys = new Set(present);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const key of stored) {
    if (presentKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  for (let index = 0; index < present.length; index++) {
    const key = present[index];
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.splice(
      anchorIndexFor(result, present, index) + 1,
      0,
      key
    );
  }

  return result;
}

function anchorIndexFor(
  result: readonly string[],
  present: readonly string[],
  index: number
): number {
  for (let previous = index - 1; previous >= 0; previous--) {
    const anchor = result.indexOf(present[previous]);
    if (anchor !== -1) {
      return anchor;
    }
  }

  return -1;
}

export function pageNamespace(
  explicit: string,
  ...parts: string[]
): string {
  if (explicit !== "") {
    return explicit;
  }

  const path = globalThis.location?.pathname ?? "";

  return [path, ...parts].join(":");
}
