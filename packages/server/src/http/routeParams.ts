// CONSTANTS
const kWildcard = "*";
const kParamPrefix = ":";

export function routeParams(
  pattern: string,
  path: string
): Record<string, string> | null {
  const expected = pattern.split("/");
  const actual = path.split("/");
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    if (segment === kWildcard) {
      params[kWildcard] = decodeURIComponent(actual.slice(index).join("/"));

      return params;
    }

    const value = actual[index];
    if (value === undefined) {
      return null;
    }
    if (segment.startsWith(kParamPrefix)) {
      params[segment.slice(kParamPrefix.length)] = decodeURIComponent(value);
    }
    else if (segment !== value) {
      return null;
    }
  }

  return expected.length === actual.length ? params : null;
}
