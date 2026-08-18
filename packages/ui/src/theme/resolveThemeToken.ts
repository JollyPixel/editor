/**
 * Resolves a computed theme token from a host, with an optional fallback.
 */
export function resolveThemeToken(
  host: HTMLElement,
  name: string,
  fallback = ""
): string {
  const value = getComputedStyle(host)
    .getPropertyValue(name)
    .trim();

  return value === "" ? fallback : value;
}

/** Resolves a theme color to a canvas-compatible computed value. */
export function resolveThemeColor(
  host: HTMLElement,
  name: string,
  fallback = ""
): string {
  const value = resolveThemeToken(host, name, fallback);
  if (value === fallback || !needsColorResolution(value)) {
    return value;
  }

  /*
   * A light-DOM child appended straight to `host` is unrendered (empty
   * computed style) when the host's shadow root has no default `<slot>` to
   * assign it to — most components here render a fixed template with none.
   * The shadow root itself is always part of the flat tree and inherits
   * `:host` custom properties the same way, so the probe goes there instead.
   */
  const probe = host.ownerDocument.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.color = `var(${name})`;
  const probeParent = host.shadowRoot ?? host;
  probeParent.append(probe);
  const resolved = getComputedStyle(probe).color.trim();
  probe.remove();

  return resolved === "" ? fallback : resolved;
}

function needsColorResolution(
  value: string
): boolean {
  return value.includes("var(") ||
    value.includes("light-dark(") ||
    value.includes("color-mix(");
}
