// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { viewportToolbarStyles } from "../../shared/styles/viewportToolbar.styles.ts";

export const editToolbarStyles = [viewportToolbarStyles, css`
  :host {
    --voxel-segment-fade-out: var(--jolly-duration-fast, 100ms);
    --voxel-segment-resize: var(--jolly-duration-base, 160ms);
    --voxel-segment-fade-in: var(--jolly-duration-base, 160ms);
    --voxel-segment-easing: var(--jolly-easing, cubic-bezier(0.2, 0, 0.2, 1));
    --voxel-segment-settle: calc(
      var(--voxel-segment-fade-out) + var(--voxel-segment-resize)
    );
    --voxel-toolbar-row-gap: 4px;

    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  jolly-rail {
    --jolly-icon-button-size: var(--voxel-toolbar-button-size);

    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--voxel-toolbar-row-gap) 0;
    height: auto;
    padding: var(--voxel-toolbar-row-gap) 4px;
    border-radius: var(--jolly-radius-sm, 2px);
    background: var(--jolly-surface-raised);
    box-shadow: var(--jolly-shadow-floating);
  }

  .segment {
    display: grid;
    grid-template-columns: 1fr;
    align-content: center;
    opacity: 1;
    transition:
      grid-template-columns var(--voxel-segment-resize)
        var(--voxel-segment-easing) var(--voxel-segment-fade-out),
      opacity var(--voxel-segment-fade-in) var(--voxel-segment-easing)
        var(--voxel-segment-settle),
      visibility 0s;
  }

  .segment[inert] {
    grid-template-columns: 0fr;
    height: 0;
    opacity: 0;
    visibility: hidden;
    transition:
      grid-template-columns var(--voxel-segment-resize)
        var(--voxel-segment-easing) var(--voxel-segment-fade-out),
      opacity var(--voxel-segment-fade-out) var(--voxel-segment-easing),
      visibility 0s linear var(--voxel-segment-settle),
      height 0s linear var(--voxel-segment-settle);
    transition-behavior: allow-discrete;
  }

  .segment-content {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    row-gap: var(--voxel-toolbar-row-gap);
    min-width: min-content;
    transition:
      translate var(--voxel-segment-fade-in) var(--voxel-segment-easing)
        var(--voxel-segment-settle),
      min-width 0s linear var(--voxel-segment-settle);
    transition-behavior: allow-discrete;
  }

  .segment[inert] > .segment-content {
    flex-wrap: nowrap;
    min-width: 0;
    overflow-x: clip;
    translate: 0 3px;
    transition: translate 0s var(--voxel-segment-fade-out);
  }

  .step-count {
    position: absolute;
    right: 0;
    bottom: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 7px;
    background: var(--jolly-tone-teal);
    color: var(--jolly-surface-raised);
    font-size: 9px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    pointer-events: none;
  }

  .step-count > span {
    text-box: trim-both cap alphabetic;
  }

  @media (prefers-reduced-motion: reduce) {
    .segment,
    .segment[inert],
    .segment-content {
      transition: none;
    }
  }
`];
