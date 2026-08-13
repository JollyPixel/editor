// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { kFallback } from "../theme/styles/fallbacks.ts";

export const dockStyles = css`
  :host {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: var(--jolly-dock-size, 240px);
    height: 100%;
    min-width: 0;
    min-height: 0;
    border-radius: 0;
    background: var(--jolly-surface, ${kFallback.controlBg});
  }

  /*
   * "align" here packs panes along the main axis, but it is also a legacy HTML
   * presentational attribute that the UA maps straight onto text-align, on
   * custom elements too. Declaring the inherited value back neutralizes that
   * hint, so align="end" stops right-aligning every word inside the dock. An
   * author setting text-align on the dock from the outside still wins.
   */
  :host([align]) {
    text-align: inherit;
  }

  :host([side="top"]),
  :host([side="bottom"]) {
    width: 100%;
    height: var(--jolly-dock-size, 240px);
  }

  /*
   * An emptied dock keeps its place in the tree but gives its space back.
   */
  :host([empty]:not([overlay])) {
    background: none;
  }

  /*
   * An overlay dock is a layout mode, not a paint mode: it leaves the flow
   * entirely so its panes read as floating, and lets pointer events through
   * the gaps between them down to whatever it covers.
   */
  :host([overlay]) {
    position: fixed;
    width: var(--jolly-dock-size, 240px);
    height: auto;
    background: none;
    pointer-events: none;
  }

  :host([overlay][side="left"]),
  :host([overlay][side="right"]) {
    inset-block: 0;
  }

  :host([overlay][side="top"]),
  :host([overlay][side="bottom"]) {
    inset-inline: 0;
    width: auto;
  }

  :host([overlay][side="left"]) {
    inset-inline-start: 0;
  }

  :host([overlay][side="right"]) {
    inset-inline-end: 0;
  }

  :host([overlay][side="top"]) {
    inset-block-start: 0;
  }

  :host([overlay][side="bottom"]) {
    inset-block-end: 0;
  }

  /*
   * Border-box, because an overlay dock pads this element: content-box would
   * add that padding to the 100% and push the panes out past the dock.
   */
  .content {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    scrollbar-color: var(--jolly-groove) transparent;
    scrollbar-width: thin;
  }

  .content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .content::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 4px;
    background: var(--jolly-groove);
    background-clip: padding-box;
  }

  /*
   * An aligned dock sizes its panes to their content and lets none of them
   * shrink, so a stack taller than the dock had nowhere to put the excess:
   * it was clipped, and the last pane went with it, along with every way of
   * reaching that pane again. Scrolling is where the excess goes, being the
   * one place that does not undo the packing the mode exists for.
   *
   * Only along the axis the panes stack on, and not on an overlay dock, which
   * is sized by its content rather than by the edge it sits on and passes
   * pointer events through the gaps between its panes.
   *
   * The gutter past the last pane is what tells a stack scrolled to its end
   * from one cut off by the edge of the dock. It costs nothing while the panes
   * still fit, since the slack they leave sits in the same place.
   */
  :host([align][side="left"]:not([overlay])) .content,
  :host([align][side="right"]:not([overlay])) .content {
    overflow-y: auto;
    padding-block-end: var(--jolly-dock-scroll-gutter, 8px);
  }

  :host([align][side="top"]:not([overlay])) .content,
  :host([align][side="bottom"]:not([overlay])) .content {
    overflow-x: auto;
    padding-inline-end: var(--jolly-dock-scroll-gutter, 8px);
  }

  :host([side="top"]) .content,
  :host([side="bottom"]) .content {
    flex-direction: row;
  }

  /*
   * Visible, because an overlay pane casts a shadow and this box ends a gap
   * away from it: clipped here, the shadow stopped dead along a straight edge
   * that reads as the dock having a surface, which is the one thing an overlay
   * dock does not have. There is nothing to contain either, the dock being
   * sized by its panes and passing pointer events between them.
   */
  :host([overlay]) .content {
    overflow: visible;
    gap: var(--jolly-dock-gap, 8px);
    padding: var(--jolly-dock-gap, 8px);
  }

  /*
   * An overlay has no painted dock surface, but its inward edge remains a
   * resize target. Keeping the handle transparent avoids creating one.
   */
  :host([overlay]) .resize-handle {
    background: transparent;
    pointer-events: auto;
  }

  :host([overlay]) .resize-handle::after {
    display: none;
  }

  :host([overlay]) .resize-handle:hover,
  :host([overlay]) .resize-handle:active,
  :host([overlay]) .resize-handle:focus-visible {
    background: transparent;
  }

  /*
   * An aligned overlay dock stacks content-sized panes rather than one pane
   * filling it, so a tall stack can still exceed the viewport's inset-block
   * bounds. Scrolling here trades the rule above's shadow-clipping avoidance
   * for staying reachable, which a pane wider than it is tall never risked
   * anyway.
   */
  :host([overlay][align][side="left"]) .content,
  :host([overlay][align][side="right"]) .content {
    overflow-y: auto;
  }

  :host([align="start"]) .content {
    justify-content: flex-start;
  }

  :host([align="end"]) .content {
    justify-content: flex-end;
  }

  /*
   * The dock is the plane here, so a pane inside it paints nothing of its own.
   */
  ::slotted(jolly-pane) {
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  /*
   * Without "align" the panes share the axis, so a lone pane still fills the
   * dock exactly as it did before multi-pane docks existed. With it they are
   * content-sized, which is what makes a folded pane visibly shrink, and
   * "grow" opts a single pane back into filling the leftover space.
   */
  /*
   * "min-height: 0" undoes a flex item's default "auto", which sizes it to
   * its content and blocks "flex-shrink" from ever taking it below that —
   * exactly the shrinking these two rules mean to allow.
   */
  :host(:not([align])) ::slotted(jolly-pane) {
    flex: 1 1 auto;
    min-height: 0;
  }

  :host([align]) ::slotted(jolly-pane) {
    flex: 0 0 auto;
    height: auto;
  }

  :host([align][side="top"]) ::slotted(jolly-pane),
  :host([align][side="bottom"]) ::slotted(jolly-pane) {
    width: auto;
    height: 100%;
  }

  :host([align]) ::slotted(jolly-pane[grow]) {
    flex: 1 1 auto;
    min-height: 0;
  }

  /*
   * An overlay pane is detached, so it paints its own raised surface. The
   * shorter elevation, not the one a window gets: these sit a gap apart in a
   * column, near enough that a window's shadow would pool between them and
   * read as one smudged block rather than as two panes.
   */
  :host([overlay]) ::slotted(jolly-pane) {
    height: auto;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--jolly-surface-raised, ${kFallback.controlBg});
    box-shadow: var(--jolly-shadow-overlay, 0 2px 8px rgb(0 0 0 / 0.3));
    pointer-events: auto;
  }

  :host([collapsed]) .content {
    visibility: hidden;
  }

  .resize-handle {
    position: absolute;
    z-index: 1;
    border: 0;
    background: var(
      --jolly-dock-resize-bg,
      color-mix(in oklab, ${kFallback.focusRing} 12%, transparent)
    );
    touch-action: none;
    transition: background-color var(--jolly-duration-base, 160ms)
      var(--jolly-easing, ease);
  }

  .resize-handle::after {
    position: absolute;
    background-image: radial-gradient(
      circle,
      var(--jolly-groove) 1.1px,
      transparent 1.3px
    );
    content: "";
    pointer-events: none;
  }

  .resize-handle:hover::after,
  .resize-handle:active::after,
  .resize-handle:focus-visible::after {
    background-image: radial-gradient(
      circle,
      var(--jolly-accent-text, ${kFallback.focusRing}) 1.1px,
      transparent 1.3px
    );
  }

  .resize-handle:hover,
  .resize-handle:active,
  .resize-handle:focus-visible {
    background: var(
      --jolly-dock-resize-bg-hover,
      color-mix(in oklab, ${kFallback.focusRing} 18%, transparent)
    );
  }

  :host([side="left"]) .resize-handle,
  :host([side="right"]) .resize-handle {
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
  }

  :host([side="left"]) .resize-handle {
    right: -4px;
  }

  :host([side="right"]) .resize-handle {
    left: -4px;
  }

  :host([side="left"]) .resize-handle::after,
  :host([side="right"]) .resize-handle::after {
    top: 50%;
    left: 50%;
    width: 3px;
    height: 22px;
    background-repeat: repeat-y;
    background-size: 100% 7px;
    transform: translate(-50%, -50%);
  }

  :host([side="top"]) .resize-handle,
  :host([side="bottom"]) .resize-handle {
    right: 0;
    left: 0;
    height: 4px;
    cursor: ns-resize;
  }

  :host([side="top"]) .resize-handle {
    bottom: -4px;
  }

  :host([side="bottom"]) .resize-handle {
    top: -4px;
  }

  :host([side="top"]) .resize-handle::after,
  :host([side="bottom"]) .resize-handle::after {
    top: 50%;
    left: 50%;
    width: 22px;
    height: 3px;
    background-repeat: repeat-x;
    background-size: 7px 100%;
    transform: translate(-50%, -50%);
  }

  .resize-handle:focus-visible {
    outline: 2px solid var(--jolly-focus-ring, ${kFallback.focusRing});
    outline-offset: -3px;
  }
`;
