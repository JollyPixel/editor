export function isInputElement(
  target: EventTarget | null
): target is HTMLInputElement {
  return target instanceof HTMLInputElement;
}

export function isSelectElement(
  target: EventTarget | null
): target is HTMLSelectElement {
  return target instanceof HTMLSelectElement;
}

export function isButtonElement(
  target: EventTarget | null
): target is HTMLButtonElement {
  return target instanceof HTMLButtonElement;
}

export function originatesInButton(
  target: EventTarget | null
): boolean {
  return target instanceof Element && target.closest("button") !== null;
}

export function isSlotElement(
  target: EventTarget | null
): target is HTMLSlotElement {
  return target instanceof HTMLSlotElement;
}

export function defaultSlotChildren(
  host: Element
): Element[] {
  return [...host.children].filter((child) => child.slot === "");
}

export function isDocumentOrShadowRoot(
  node: Node
): node is Document | ShadowRoot {
  return node instanceof Document || node instanceof ShadowRoot;
}

export function composedClosest<K extends keyof HTMLElementTagNameMap>(
  element: Element,
  selector: K
): HTMLElementTagNameMap[K] | null;
export function composedClosest(
  element: Element,
  selector: string
): Element | null;
export function composedClosest(
  element: Element,
  selector: string
): Element | null {
  const match = element.closest(selector);
  if (match !== null) {
    return match;
  }

  const root = element.getRootNode();

  return root instanceof ShadowRoot ? composedClosest(root.host, selector) : null;
}

export function deepActiveElement(
  root: Document | ShadowRoot = document
): HTMLElement | null {
  let active = root.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }

  return active instanceof HTMLElement ? active : null;
}

export function stopPropagation(
  event: Event
): void {
  event.stopPropagation();
}

export function preventDefault(
  event: Event
): void {
  event.preventDefault();
}

export function readDetail<TDetail>(
  event: Event
): TDetail | null {
  return event instanceof CustomEvent ? event.detail : null;
}
