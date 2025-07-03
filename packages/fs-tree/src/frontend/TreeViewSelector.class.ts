export interface TreeViewSelectorOptions {
  multipleSelection?: boolean;
}

export class TreeViewSelector {
  private multipleSelection: boolean;

  nodes: Element[] = [];
  firstSelectedNode: Element | null = null;

  constructor(
    options: TreeViewSelectorOptions = {}
  ) {
    const { multipleSelection = true } = options;

    this.multipleSelection = multipleSelection;
  }

  get size(): number {
    return this.nodes.length;
  }

  clear(): void {
    for (const selectedNode of this.nodes) {
      selectedNode.classList.remove("selected");
    }
    this.nodes.length = 0;
    this.firstSelectedNode = null;
  }

  has(
    element: Element
  ): boolean {
    return this.nodes.indexOf(element) !== -1;
  }

  add(
    element: Element
  ): void {
    if (this.has(element)) {
      return;
    }

    this.nodes.push(element);
    element.classList.add("selected");

    if (this.nodes.length === 1) {
      this.firstSelectedNode = element;
    }
  }

  remove(
    element: Element
  ): void {
    const selectedIndex = this.nodes.indexOf(element);
    if (selectedIndex !== -1) {
      element.classList.remove("selected");
      this.nodes.splice(selectedIndex, 1);
    }

    if (this.firstSelectedNode !== element) {
      return;
    }

    if (this.nodes.length > 0) {
      this.firstSelectedNode = this.nodes[0];
    }
    else {
      this.clear();
    }
  }

  updateSelection(
    rootElement: HTMLElement,
    event: MouseEvent
  ): boolean {
    let selectionChanged = false;

    if (
      (!this.multipleSelection || (!event.shiftKey && !event.ctrlKey)) &&
      this.nodes.length > 0
    ) {
      this.clear();
      selectionChanged = true;
    }

    if (!(event.target instanceof HTMLElement)) {
      return false;
    }

    let ancestorElement = event.target;
    while (
      ancestorElement.tagName !== "LI" ||
      (!ancestorElement.classList.contains("item") && !ancestorElement.classList.contains("group"))
    ) {
      if (ancestorElement === rootElement) {
        return selectionChanged;
      }
      ancestorElement = ancestorElement.parentElement!;
    }

    const element = ancestorElement;

    if (this.nodes.length > 0 && this.nodes[0].parentElement !== element.parentElement) {
      return selectionChanged;
    }

    if (this.multipleSelection && event.shiftKey && this.nodes.length > 0) {
      const startElement = this.firstSelectedNode;
      const elements: Element[] = [];
      let inside = false;

      for (let i = 0; i < element.parentElement!.children.length; i++) {
        const child = element.parentElement!.children[i];

        if (child === startElement || child === element) {
          if (inside || startElement === element) {
            elements.push(child);
            break;
          }
          inside = true;
        }

        if (inside && child.tagName === "LI") {
          elements.push(child);
        }
      }

      this.clear();
      this.nodes = elements;
      this.firstSelectedNode = startElement;
      for (const selectedNode of this.nodes) {
        selectedNode.classList.add("selected");
      }

      return true;
    }

    if (event.ctrlKey && this.has(element)) {
      this.remove(element);
    }
    else {
      this.add(element);
    }

    return true;
  }
}
