export interface SelectableTab {
  layoutKey: string;
  disabled: boolean;
}

export function resolveActiveTab(
  tabs: readonly SelectableTab[],
  requested: string
): string {
  if (tabs.length === 0) {
    return requested;
  }

  const match = tabs.find(
    (tab) => tab.layoutKey === requested && !tab.disabled
  );
  const fallback = tabs.find((tab) => !tab.disabled) ?? tabs[0];

  return (match ?? fallback).layoutKey;
}

export function tabNavigationTarget(
  tabs: readonly SelectableTab[],
  key: string,
  current: number
): number {
  const enabled = tabs.flatMap(
    (tab, index) => (tab.disabled ? [] : [index])
  );
  if (enabled.length === 0) {
    return -1;
  }

  switch (key) {
    case "Home":
      return enabled[0];
    case "End":
      return enabled[enabled.length - 1];
    case "ArrowLeft":
      return enabled.findLast((index) => index < current) ??
        enabled[enabled.length - 1];
    case "ArrowRight":
      return enabled.find((index) => index > current) ?? enabled[0];
    default:
      return -1;
  }
}
