export function lastSegment(
  address: string
): string {
  return address.slice(address.lastIndexOf(".") + 1);
}

export function parentAddress(
  address: string
): string {
  const dot = address.lastIndexOf(".");

  return dot === -1 ? "" : address.slice(0, dot);
}

export function* ancestorAddresses(
  address: string
): IterableIterator<string> {
  let dot = address.indexOf(".");
  while (dot !== -1) {
    yield address.slice(0, dot);
    dot = address.indexOf(".", dot + 1);
  }
}

export function isWithin(
  address: string,
  scope: string
): boolean {
  return scope === "" ||
    address.toLowerCase().startsWith(`${scope.toLowerCase()}.`);
}

export function relativeAddress(
  address: string,
  scope: string
): string {
  return scope !== "" && isWithin(address, scope) ?
    address.slice(scope.length + 1) :
    address;
}
