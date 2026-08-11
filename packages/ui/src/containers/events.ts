export interface JollyResizeDetail {
  width: number;
  height: number;
  collapsed: boolean;
}

export interface JollyMoveDetail {
  x: number;
  y: number;
}

export interface JollyReorderDetail {
  keys: string[];
}

export interface JollyToggleDetail {
  open: boolean;
}

export interface JollyTabChangeDetail {
  value: string;
}

export function emitContainerEvent<TDetail>(
  target: EventTarget,
  name: string,
  detail: TDetail
): void {
  const event = new CustomEvent<TDetail>(name, {
    detail,
    bubbles: true,
    composed: true
  });
  target.dispatchEvent(event);
}
