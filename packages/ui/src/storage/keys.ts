// CONSTANTS
const kCombiningMarks = /[̀-ͯ]/g;
const kNonAlphanumeric = /[^a-z0-9]+/g;
const kEdgeSeparators = /^-+|-+$/g;

/**
 * Folds diacritics rather than stripping them: a plain non-alphanumeric strip turns
 * "Rotation générale" into "rotation-g-n-rale".
 */
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

/**
 * Keys a control by what it is, not where it sits, so inserting a sibling does not scramble saved
 * positions. The caller reads tag name, label and 1-based occurrence, which keeps this pure.
 *
 * Gotcha: removing an earlier duplicate renumbers the survivors, so one inherits the deleted
 * item's stored position. An explicit key is the escape hatch.
 */
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

/**
 * Reconciles a stored order against the keys declared this render. Stored keys that are gone drop
 * out; a new key lands after its nearest surviving declared sibling, or at the front, so adding a
 * control mid source puts it mid pane rather than at the end.
 */
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
