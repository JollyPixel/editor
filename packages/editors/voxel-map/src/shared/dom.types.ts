export type EventInput = Event & {
  target: HTMLInputElement;
};
export type EventCanvasHoverChange = CustomEvent<{ hovering: boolean; }>;
