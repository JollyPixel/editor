// CONSTANTS
const kFunctionPattern = /^([a-z]+)\(([^()]*)\)$/i;
const kWhitespace = /\s+/;

export interface ColorFunction {
  name: string;
  args: [string, string, string];
  alpha: string | null;
  legacy: boolean;
}

/**
 * Tokenizes comma or slash syntax and rejects mixed separators.
 */
export function parseFunction(
  input: string
): ColorFunction | null {
  const match = kFunctionPattern.exec(input.trim());
  if (match === null) {
    return null;
  }

  const name = match[1].toLowerCase();
  const body = match[2].trim();
  const legacy = body.includes(",");
  const tokens = legacy ?
    commaTokens(body) :
    slashTokens(body);

  if (tokens === null) {
    return null;
  }

  const [
    first,
    second,
    third,
    alpha = null
  ] = tokens;

  return {
    name,
    args: [first, second, third],
    alpha,
    legacy
  };
}

function commaTokens(
  body: string
): string[] | null {
  if (body.includes("/")) {
    return null;
  }

  const tokens = body
    .split(",")
    .map((token) => token.trim());

  return sized(tokens);
}

function slashTokens(
  body: string
): string[] | null {
  const [
    channels,
    alpha,
    ...rest
  ] = body.split("/").map((part) => part.trim());

  if (rest.length > 0) {
    return null;
  }

  const tokens = channels === "" ?
    [] :
    channels.split(kWhitespace);
  if (alpha !== undefined) {
    tokens.push(alpha);
  }

  return sized(tokens);
}

function sized(
  tokens: string[]
): string[] | null {
  if (
    tokens.length < 3 ||
    tokens.length > 4 ||
    tokens.some((token) => token === "")
  ) {
    return null;
  }

  return tokens;
}
