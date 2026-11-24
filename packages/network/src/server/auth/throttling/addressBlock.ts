// CONSTANTS
const kIPv6PrefixHextets = 4;
const kIPv6Hextets = 8;

export function addressBlock(
  address: string | undefined
): string {
  if (address === undefined) {
    return "";
  }
  if (!address.includes(":") || address.includes(".")) {
    return address;
  }

  const prefix = ipv6Hextets(address.split("%")[0])
    .slice(0, kIPv6PrefixHextets)
    .map((hextet) => Number.parseInt(hextet, 16).toString(16));

  return `${prefix.join(":")}::/64`;
}

function ipv6Hextets(
  address: string
): string[] {
  const [head, tail] = address.split("::");
  const left = head === "" ? [] : head.split(":");
  if (tail === undefined) {
    return left;
  }

  const right = tail === "" ? [] : tail.split(":");
  const zeros = Array.from(
    { length: kIPv6Hextets - left.length - right.length },
    () => "0"
  );

  return [...left, ...zeros, ...right];
}
