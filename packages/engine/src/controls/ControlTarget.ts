export interface ControlTarget {
  connect(): void;
  disconnect(): void;
  reset(): void;
  update?(): void;
  readonly domElement?: HTMLElement;
}
