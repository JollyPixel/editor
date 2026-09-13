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

export function resolveThemeColor(
  host: HTMLElement,
  name: string,
  fallback = ""
): string {
  const value = resolveThemeToken(
    host,
    name,
    fallback
  );
  if (value === fallback || !needsColorResolution(value)) {
    return value;
  }

  return probeColor(
    host,
    `var(${name})`,
    fallback
  );
}

export function resolveCssColor(
  host: HTMLElement,
  value: string,
  fallback = ""
): string {
  const color = value.trim();
  if (color === "") {
    return fallback;
  }
  if (!needsColorResolution(color)) {
    return color;
  }

  return probeColor(
    host,
    color,
    fallback
  );
}

function probeColor(
  host: HTMLElement,
  color: string,
  fallback: string
): string {
  const probe = host.ownerDocument.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.color = color;

  if (probe.style.color === "") {
    return fallback;
  }

  const probeParent = host.shadowRoot ?? host;
  probeParent.append(probe);
  const resolved = getComputedStyle(
    probe
  ).color.trim();
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
