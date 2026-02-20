// Import Internal Dependencies
import {
  TreeViewSelector
} from "./TreeViewSelector.class.ts";

export interface DropLocation {
  target: Element;
  where: "above" | "inside" | "below";
}

export type DragStartCallback = (
  event: DragEvent,
  node: HTMLLIElement
) => boolean;
export type DropCallback = (
  event: DragEvent,
  dropLocation: DropLocation,
  orderedNodes: HTMLLIElement[]
) => boolean;

/**
 * Options for configuring the `TreeView` instance.
 */
export interface TreeViewOptions {
  /**
   * Callback invoked when a drag is initiated on a node.
   * Return `false` to cancel the drag operation.
   * @default null
   */
  dragStartCallback?: DragStartCallback;

  /**
   * Callback invoked when a drop occurs.
   * Return `false` to prevent reparenting of the dragged nodes.
   * @default null
   */
  dropCallback?: DropCallback;

  /**
   * When `true`, enables selecting multiple nodes in the tree.
   * @default false
   */
  multipleSelection?: boolean;
}

export class TreeView extends EventTarget {
  root: HTMLOListElement;
  selector: TreeViewSelector;

  private dragStartCallback: DragStartCallback | null;
  private dropCallback: DropCallback | null;
  private previousDropLocation: DropLocation | null;
  private hasDraggedOverAfterLeaving: boolean;
  private isDraggingNodes: boolean;

  constructor(
    container: HTMLDivElement,
    options: TreeViewOptions = {}
  ) {
    super();

    const {
      dragStartCallback = null,
      dropCallback = null
    } = options;

    this.selector = new TreeViewSelector({
      multipleSelection: options.multipleSelection
    });
    this.dragStartCallback = dragStartCallback;
    this.dropCallback = dropCallback;

    this.root = document.createElement("ol");
    this.root.tabIndex = 0;
    this.root.classList.add("tree");
    this.root.addEventListener("click", this.onClick);
    this.root.addEventListener("dblclick", this.onDoubleClick);
    this.root.addEventListener("keydown", this.onKeyDown);

    if (this.dragStartCallback) {
      this.root.addEventListener("dragstart", this.onDragStart);
      this.root.addEventListener("dragend", this.onDragEnd);
    }

    if (this.dropCallback) {
      this.root.addEventListener("dragover", this.onDragOver);
      this.root.addEventListener("dragleave", this.onDragLeave);
      this.root.addEventListener("drop", this.onDrop);
    }

    container.appendChild(this.root);
    container.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
      }
    });
  }

  scrollIntoView(
    element: Element
  ) {
    let ancestor = element.parentElement;
    while (ancestor && ancestor.className === "children") {
      ancestor.previousElementSibling?.classList.remove("collapsed");
      ancestor = ancestor.parentElement;
    }

    const elementRect = element.getBoundingClientRect();
    if (!this.root.parentElement) {
      return;
    }

    const containerRect = this.root.parentElement.getBoundingClientRect();
    if (elementRect.top < containerRect.top) {
      element.scrollIntoView(true);
    }
    else if (elementRect.bottom > containerRect.bottom) {
      element.scrollIntoView(false);
    }
  }

  clear() {
    this.root.innerHTML = "";
    this.selector.clear();
    this.hasDraggedOverAfterLeaving = false;
    this.isDraggingNodes = false;
  }

  append(
    element: HTMLLIElement,
    type: "item" | "group",
    parentGroupElement?: HTMLLIElement
  ): HTMLLIElement {
    let childrenElt: Element | null = null;
    let siblingsElt: Element;

    if (parentGroupElement) {
      if (!isGroup(parentGroupElement)) {
        throw new Error("Invalid parent group");
      }
      siblingsElt = parentGroupElement.nextElementSibling!;
    }
    else {
      siblingsElt = this.root;
    }

    if (!element.classList.contains(type)) {
      element.classList.add(type);
      element.draggable = this.dragStartCallback !== null;

      if (type === "group") {
        const toggleElt = document.createElement("div");
        toggleElt.classList.add("toggle");
        element.insertBefore(toggleElt, element.firstChild);

        childrenElt = document.createElement("ol");
        childrenElt.classList.add("children");
      }
    }
    else if (type === "group") {
      childrenElt = element.nextElementSibling;
    }

    siblingsElt.appendChild(element);
    childrenElt && siblingsElt.appendChild(childrenElt);

    return element;
  }

  insertBefore(
    element: HTMLLIElement,
    type: "item" | "group",
    referenceElement: HTMLLIElement
  ): HTMLLIElement {
    let childrenElt: Element | null = null;

    if (!element.classList.contains(type)) {
      element.classList.add(type);
      element.draggable = this.dragStartCallback !== null;

      if (type === "group") {
        const toggleElt = document.createElement("div");
        toggleElt.classList.add("toggle");
        element.insertBefore(toggleElt, element.firstChild);

        childrenElt = document.createElement("ol");
        childrenElt.classList.add("children");
      }
    }
    else if (type === "group") {
      childrenElt = element.nextElementSibling;
    }

    if (referenceElement.parentElement) {
      referenceElement.parentElement.insertBefore(element, referenceElement);
      if (childrenElt) {
        referenceElement.parentElement.insertBefore(childrenElt, element.nextSibling);
      }
    }

    return element;
  }

  insertAt(
    element: HTMLLIElement,
    type: "item" | "group",
    index: number
  ): HTMLLIElement | null {
    const referenceElt = (
      this.root.querySelector<HTMLLIElement>(`:scope > li:nth-of-type(${index + 1})`)
    );

    return referenceElt ?
      this.insertBefore(element, type, referenceElt) :
      null;
  }

  remove(
    element: HTMLLIElement
  ) {
    this.selector.remove(element);
    if (!element.parentElement) {
      return;
    }

    if (element.classList.contains("group")) {
      const childrenElement = element.nextElementSibling;
      this.selector.nodes
        .filter((selectedNode) => childrenElement?.contains(selectedNode))
        .forEach((node) => this.selector.remove(node));

      childrenElement && element.parentElement.removeChild(childrenElement);
    }

    element.parentElement.removeChild(element);
  }

  moveVertically(
    offset: number
  ) {
    let node: Element | null = this.selector.firstSelectedNode;
    if (!node) {
      return;
    }

    if (offset === -1) {
      if (node.previousElementSibling) {
        let target: Element | null = node.previousElementSibling;

        while (target && target.classList.contains("children")) {
          if (
            !target.previousElementSibling!.classList.contains("collapsed") &&
            target.childElementCount > 0
          ) {
            target = target.lastElementChild;
          }
          else {
            target = target.previousElementSibling;
          }
        }
        node = target;
      }
      else if (node.parentElement!.classList.contains("children")) {
        node = node.parentElement!.previousElementSibling;
      }
      else {
        return;
      }
    }
    else {
      let walkUp = false;
      if (node.classList.contains("group")) {
        if (
          !node.classList.contains("collapsed") &&
          node.nextElementSibling &&
          node.nextElementSibling.childElementCount > 0
        ) {
          node = node.nextElementSibling.firstElementChild;
        }
        else if (node.nextElementSibling && node.nextElementSibling.nextElementSibling) {
          node = node.nextElementSibling.nextElementSibling;
        }
        else {
          walkUp = true;
        }
      }
      else if (node.nextElementSibling) {
        node = node.nextElementSibling;
      }
      else {
        walkUp = true;
      }

      if (walkUp && node) {
        if (node.parentElement && node.parentElement.classList.contains("children")) {
          let target = node.parentElement;
          while (target.nextElementSibling === null) {
            target = target.parentElement!;
            if (!target.classList.contains("children")) {
              return;
            }
          }
          node = target.nextElementSibling;
        }
        else {
          return;
        }
      }
    }

    if (node === null) {
      return;
    }

    this.selector.clear();
    this.selector.add(node);
    this.scrollIntoView(node);
    this.dispatchEvent(new Event("selectionChange"));
  }

  moveHorizontally(
    offset: number
  ) {
    let node = this.selector.firstSelectedNode;
    if (!node) {
      return;
    }

    if (offset === -1) {
      if (!node.classList.contains("group") || node.classList.contains("collapsed")) {
        if (!node.parentElement!.classList.contains("children")) {
          return;
        }
        node = node.parentElement!.previousElementSibling;
      }
      else if (node.classList.contains("group")) {
        node.classList.add("collapsed");
      }
    }
    else if (node.classList.contains("group")) {
      if (node.classList.contains("collapsed")) {
        node.classList.remove("collapsed");
      }
      else {
        node = node.nextSibling!.firstChild as HTMLLIElement;
      }
    }

    if (node === null) {
      return;
    }

    this.selector.clear();
    this.selector.add(node);
    this.scrollIntoView(node);
    this.dispatchEvent(new Event("selectionChange"));
  }

  private getDropLocation(
    event: DragEvent
  ): DropLocation | null {
    if (!(event.target instanceof HTMLElement)) {
      return null;
    }

    let element = event.target;
    if (
      element.tagName === "OL" &&
      element.classList.contains("children")
    ) {
      element = element.parentElement!;
    }

    if (element === this.root) {
      element = element.lastChild as HTMLElement;
      if (element === null) {
        return {
          target: this.root,
          where: "inside"
        };
      }
      if (element.tagName === "OL") {
        element = element.previousSibling as HTMLElement;
      }

      return {
        target: element,
        where: "below"
      };
    }

    while ((!isGroup(element) && !isItem(element))) {
      if (element === this.root) {
        return null;
      }
      element = element.parentElement!;
    }

    let where = this.getInsertionPoint(element, event.pageY);
    if (where === "below") {
      if (
        element.classList.contains("item") &&
        element.nextElementSibling &&
        element.nextElementSibling.tagName === "LI"
      ) {
        element = element.nextElementSibling as HTMLElement;
        where = "above";
      }
      else if (
        element.classList.contains("group") &&
        element.nextElementSibling &&
        element.nextElementSibling.nextElementSibling &&
        element.nextElementSibling.nextElementSibling.tagName === "LI"
      ) {
        element = element.nextElementSibling.nextElementSibling as HTMLElement;
        where = "above";
      }
    }

    return {
      target: element,
      where
    };
  }

  private getInsertionPoint(
    element: HTMLElement,
    y: number
  ): "above" | "below" | "inside" {
    const rect = element.getBoundingClientRect();
    const offset = y - rect.top;

    if (offset < rect.height / 4) {
      return "above";
    }
    if (offset > rect.height * 3 / 4) {
      return (
        element.classList.contains("group") &&
        element.nextElementSibling &&
        element.nextElementSibling.childElementCount > 0
      ) ? "inside" : "below";
    }

    return element.classList.contains("item") ? "below" : "inside";
  }

  private clearDropClasses() {
    this.root
      .querySelector(".drop-above")?.classList.remove("drop-above");
    this.root
      .querySelector(".drop-inside")?.classList.remove("drop-inside");
    this.root
      .querySelector(".drop-below")?.classList.remove("drop-below");
    // For the rare case where we're dropping a foreign item into an empty tree view
    this.root.classList.remove("drop-inside");
  }

  private onClick = (event: MouseEvent) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    const element = event.target;
    if (
      element.className === "toggle" &&
      isGroup(element.parentElement)
    ) {
      element.parentElement.classList.toggle("collapsed");
    }
    else if (
      !["BUTTON", "INPUT", "SELECT"].includes(element.tagName) &&
      this.selector.updateSelection(this.root, event)
    ) {
      this.dispatchEvent(new Event("selectionChange"));
    }
  };

  private onDoubleClick = (event: MouseEvent) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const element = event.target;

    if (
      this.selector.size !== 1 ||
      element.tagName === "BUTTON" ||
      element.tagName === "INPUT" ||
      element.tagName === "SELECT" ||
      element.className === "toggle"
    ) {
      return;
    }

    this.dispatchEvent(
      new Event("activate")
    );
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (document.activeElement !== this.root) {
      return;
    }

    if (this.selector.firstSelectedNode === null) {
      if (event.key === "ArrowDown") {
        this.selector.add(this.root.firstElementChild!);
        this.dispatchEvent(new Event("selectionChange"));
        event.preventDefault();
      }

      return;
    }

    switch (event.key) {
      case "ArrowUp":
        this.moveVertically(-1);
        event.preventDefault();
        break;
      case "ArrowDown":
        this.moveVertically(1);
        event.preventDefault();
        break;

      case "ArrowLeft":
        this.moveHorizontally(-1);
        event.preventDefault();
        break;
      case "ArrowRight":
        this.moveHorizontally(1);
        event.preventDefault();
        break;

      case "Enter":
        if (this.selector.size === 1) {
          this.dispatchEvent(new Event("activate"));
          event.preventDefault();
        }
        break;
    }
  };

  private onDragStart = (event: DragEvent) => {
    const element = event.target as HTMLLIElement;

    if (!isGroup(element) && !isItem(element)) {
      return false;
    }

    if (!this.selector.has(element)) {
      this.selector.clear();
      this.selector.add(element);
      this.dispatchEvent(
        new Event("selectionChange")
      );
    }

    if (this.dragStartCallback && !this.dragStartCallback(event, element)) {
      return false;
    }

    this.isDraggingNodes = true;

    return true;
  };

  private onDragEnd = () => {
    this.previousDropLocation = null;
    this.isDraggingNodes = false;
  };

  private onDragOver = (event: DragEvent) => {
    const dropLocation = this.getDropLocation(event);
    if (dropLocation === null) {
      return false;
    }

    // If we're dragging nodes from the current tree view
    // Prevent dropping into descendant
    if (this.isDraggingNodes) {
      if (
        dropLocation.where === "inside" &&
        this.selector.has(dropLocation.target)
      ) {
        return false;
      }

      for (const selectedNode of this.selector.nodes) {
        if (
          selectedNode.classList.contains("group") &&
          selectedNode.nextElementSibling &&
          selectedNode.nextElementSibling.contains(dropLocation.target)
        ) {
          return false;
        }
      }
    }

    this.hasDraggedOverAfterLeaving = true;

    if (
      this.previousDropLocation === null ||
      this.previousDropLocation?.where !== dropLocation.where ||
      this.previousDropLocation?.target !== dropLocation.target
    ) {
      this.previousDropLocation = dropLocation;

      this.clearDropClasses();
      dropLocation.target.classList.add(`drop-${dropLocation.where}`);
    }

    return event.preventDefault();
  };

  private onDragLeave = () => {
    this.hasDraggedOverAfterLeaving = false;
    setTimeout(() => {
      if (!this.hasDraggedOverAfterLeaving) {
        this.clearDropClasses();
      }
    }, 300);
  };

  private onDrop = (event: DragEvent) => {
    this.previousDropLocation = null;
    event.preventDefault();

    const dropLocation = this.getDropLocation(event);
    if (dropLocation === null) {
      return;
    }

    this.clearDropClasses();
    if (!this.isDraggingNodes) {
      this.dropCallback?.(event, dropLocation, []);

      return;
    }

    const children = this.selector.nodes[0].parentElement!.children as unknown as HTMLLIElement[];
    const orderedNodes: HTMLLIElement[] = [...children]
      .filter((child) => this.selector.has(child));

    const reparent = this.dropCallback ?
      this.dropCallback(event, dropLocation, orderedNodes) :
      true;
    if (!reparent) {
      return;
    }

    let newParent: Element | null = null;
    let referenceElt: Element | null;

    switch (dropLocation.where) {
      case "inside":
        if (!dropLocation.target.classList.contains("group")) {
          return;
        }

        newParent = dropLocation.target.nextElementSibling;
        referenceElt = null;
        break;

      case "below":
        newParent = dropLocation.target.parentElement;
        referenceElt = dropLocation.target.nextElementSibling;
        if (referenceElt && referenceElt.tagName === "OL") {
          referenceElt = referenceElt.nextElementSibling;
        }
        break;

      case "above":
        newParent = dropLocation.target.parentElement;
        referenceElt = dropLocation.target;
        break;
    }

    let draggedChildren: Element | null = null;

    for (const selectedNode of orderedNodes) {
      if (selectedNode.classList.contains("group")) {
        draggedChildren = selectedNode.nextElementSibling;
        draggedChildren && draggedChildren.parentElement!.removeChild(draggedChildren);
      }

      if (referenceElt === selectedNode) {
        referenceElt = selectedNode.nextElementSibling;
      }

      selectedNode.parentElement!.removeChild(selectedNode);
      newParent?.insertBefore(selectedNode, referenceElt);
      referenceElt = selectedNode.nextElementSibling;

      if (draggedChildren) {
        newParent?.insertBefore(draggedChildren, referenceElt);
        referenceElt = draggedChildren.nextElementSibling;
      }
    }

    return;
  };
}

function isGroup(
  element: Element | HTMLLIElement | HTMLElement | null
): element is HTMLLIElement {
  return element !== null &&
    element.tagName === "LI" &&
    element.classList.contains("group");
}

function isItem(
  element: HTMLElement | null
): element is HTMLLIElement {
  return element !== null &&
    element.tagName === "LI" &&
    element.classList.contains("item");
}
