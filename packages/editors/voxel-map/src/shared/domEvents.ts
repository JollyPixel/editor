export type EventInput = Event & {
  target: HTMLInputElement;
};
export type EventCanvasHoverChange = CustomEvent<{ hovering: boolean; }>;

declare global {
  interface HTMLElementEventMap {
    "canvas-hover-change": EventCanvasHoverChange;
  }
}
