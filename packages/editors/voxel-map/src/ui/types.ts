export type EventInput = Event & {
  target: HTMLInputElement;
};
export type EventSelect = Event & {
  target: HTMLSelectElement;
};
export type EventCanvasHoverChange = CustomEvent<{ hovering: boolean; }>;
