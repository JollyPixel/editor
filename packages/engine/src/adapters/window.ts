export interface WindowAdapter {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export class BrowserWindowAdapter implements WindowAdapter {
  addEventListener(
    type: string,
    listener: () => void
  ) {
    window.addEventListener(type, listener);
  }

  removeEventListener(
    type: string,
    listener: () => void
  ) {
    window.removeEventListener(type, listener);
  }
}
