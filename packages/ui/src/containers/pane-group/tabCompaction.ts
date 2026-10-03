// CONSTANTS
const kSubpixelTolerance = 0.5;

export interface TabExtent {
  /** Rendered width of the tab button, in CSS pixels. */
  tabWidth: number;
  /** Rendered width of its label, possibly cut off; ignored while hidden. */
  labelWidth: number;
  /** Width the label needs to show in full. */
  labelContentWidth: number;
  /** Whether the label is out of the layout, as on an icon-only tab. */
  labelHidden: boolean;
  /** Gap between the tab's icon and label, which a hidden label drops. */
  innerGap: number;
}

export function naturalTabsWidth(
  tabs: Iterable<TabExtent>,
  gap: number
): number {
  let total = 0;
  let count = 0;
  for (const tab of tabs) {
    total += tab.tabWidth + missingLabelWidth(tab);
    count++;
  }

  return total + (gap * Math.max(count - 1, 0));
}

export function tabLabelsFit(
  naturalWidth: number,
  availableWidth: number
): boolean {
  return naturalWidth <= availableWidth + kSubpixelTolerance;
}

function missingLabelWidth(
  tab: TabExtent
): number {
  return tab.labelHidden ?
    tab.innerGap + tab.labelContentWidth :
    Math.max(tab.labelContentWidth - tab.labelWidth, 0);
}
