interface DropLocation {
  target: HTMLLIElement | HTMLOListElement;
  where: "above" | "inside" | "below";
}

type DragStartCallback = (
  event: DragEvent,
  node: HTMLLIElement
) => boolean;
type DropCallback = (
  event: DragEvent,
  dropLocation: DropLocation,
  orderedNodes: HTMLLIElement[]
) => boolean;

export interface TreeViewOptions {
  dragStartCallback?: DragStartCallback;
  dropCallback?: DropCallback;
  multipleSelection?: boolean;
}

export class TreeView extends EventTarget {
  root: HTMLOListElement;
  selectedNodes: HTMLLIElement[];

  private dragStartCallback: DragStartCallback | null;
  private dropCallback: DropCallback | null;
  private multipleSelection: boolean;

  private firstSelectedNode: HTMLLIElement | null;
  private previousDropLocation: DropLocation | null;
  private hasDraggedOverAfterLeaving: boolean;
  private isDraggingNodes: boolean;

  constructor(
    container: HTMLDivElement,
    options: TreeViewOptions = {}
  ) {
    super();

    const {
      multipleSelection = true,
      dragStartCallback = null,
      dropCallback = null
    } = options;

    this.multipleSelection = multipleSelection;
    this.dragStartCallback = dragStartCallback;
    this.dropCallback = dropCallback;
    this.root = document.createElement("ol");
    this.root.tabIndex = 0;
    this.root.classList.add("tree");
    container.appendChild(this.root);

    this.selectedNodes = [];
    this.firstSelectedNode = null;

    this.root.addEventListener("click", this.onClick);
    this.root.addEventListener("dblclick", this.onDoubleClick);
    this.root.addEventListener("keydown", this.onKeyDown);
    container.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
      }
    });

    if (this.dragStartCallback) {
      this.root.addEventListener("dragstart", this.onDragStart);
      this.root.addEventListener("dragend", this.onDragEnd);
    }

    if (this.dropCallback) {
      this.root.addEventListener("dragover", this.onDragOver);
      this.root.addEventListener("dragleave", this.onDragLeave);
      this.root.addEventListener("drop", this.onDrop);
    }
  }

  clearSelection() {
    for (const selectedNode of this.selectedNodes) {
      selectedNode.classList.remove("selected");
    }
    this.selectedNodes.length = 0;
    this.firstSelectedNode = null;
  }

  addToSelection(element: HTMLLIElement) {
    if (this.selectedNodes.indexOf(element) !== -1) {
      return;
    }

    this.selectedNodes.push(element);
    element.classList.add("selected");

    if (this.selectedNodes.length === 1) {
      this.firstSelectedNode = element;
    }
  }

  scrollIntoView(
    element: HTMLLIElement
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
    this.selectedNodes.length = 0;
    this.firstSelectedNode = null;
    this.hasDraggedOverAfterLeaving = false;
    this.isDraggingNodes = false;
  }

  append(
    element: HTMLLIElement,
    type: "item" | "group",
    parentGroupElement?: HTMLLIElement
  ) {
    let childrenElt: HTMLOListElement | null = null;
    let siblingsElt: HTMLOListElement;

    if (parentGroupElement) {
      if (!isGroup(parentGroupElement)) {
        throw new Error("Invalid parent group");
      }
      siblingsElt = parentGroupElement.nextSibling as HTMLOListElement;
    }
    else {
      siblingsElt = this.root;
    }

    if (!element.classList.contains(type)) {
      element.classList.add(type);
      if (this.dragStartCallback) {
        element.draggable = true;
      }

      if (type === "group") {
        const toggleElt = document.createElement("div");
        toggleElt.classList.add("toggle");
        element.insertBefore(toggleElt, element.firstChild);

        childrenElt = document.createElement("ol");
        childrenElt.classList.add("children");
      }
    }
    else if (type === "group") {
      childrenElt = element.nextSibling as HTMLOListElement;
    }

    siblingsElt.appendChild(element);
    if (childrenElt) {
      siblingsElt.appendChild(childrenElt);
    }

    return element;
  }

  insertBefore(
    element: HTMLLIElement,
    type: "item" | "group",
    referenceElement: HTMLLIElement
  ) {
    let childrenElt: HTMLOListElement | null = null;

    if (!element.classList.contains(type)) {
      element.classList.add(type);
      if (this.dragStartCallback) {
        element.draggable = true;
      }

      if (type === "group") {
        const toggleElt = document.createElement("div");
        toggleElt.classList.add("toggle");
        element.insertBefore(toggleElt, element.firstChild);

        childrenElt = document.createElement("ol");
        childrenElt.classList.add("children");
      }
    }
    else if (type === "group") {
      childrenElt = element.nextSibling as HTMLOListElement;
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
  ) {
    const referenceElt = (
      this.root.querySelector(`:scope > li:nth-of-type(${index + 1})`)
    ) as HTMLLIElement;

    if (referenceElt) {
      this.insertBefore(element, type, referenceElt);
    }
  }

  remove(
    element: HTMLLIElement
  ) {
    const selectedIndex = this.selectedNodes.indexOf(element);
    if (selectedIndex !== -1) {
      element.classList.remove("selected");
      this.selectedNodes.splice(selectedIndex, 1);
    }
    if (this.firstSelectedNode === element) {
      this.firstSelectedNode = this.selectedNodes[0];
    }

    if (element.classList.contains("group")) {
      const childrenElement = element.nextSibling as HTMLElement;

      const removedSelectedNodes: HTMLLIElement[] = [];
      for (const selectedNode of this.selectedNodes) {
        if (childrenElement.contains(selectedNode)) {
          removedSelectedNodes.push(selectedNode);
        }
      }

      for (const removedSelectedNode of removedSelectedNodes) {
        removedSelectedNode.classList.remove("selected");
        this.selectedNodes.splice(this.selectedNodes.indexOf(removedSelectedNode), 1);
        if (this.firstSelectedNode === removedSelectedNode) {
          this.firstSelectedNode = this.selectedNodes[0];
        }
      }

      element.parentElement!.removeChild(childrenElement);
    }

    element.parentElement!.removeChild(element);
  }

  private onClick = (event: MouseEvent) => {
    const element = event.target as HTMLElement;

    if (element.className === "toggle" && isGroup(element.parentElement)) {
      element.parentElement.classList.toggle("collapsed");
    }
    else if (
      !["BUTTON", "INPUT", "SELECT"].includes(element.tagName) &&
      this.updateSelection(event)
    ) {
      this.dispatchEvent(new Event("selectionChange"));
    }
  };

  // Returns whether the selection changed
  private updateSelection(event: MouseEvent) {
    let selectionChanged = false;

    if (
      (!this.multipleSelection || (!event.shiftKey && !event.ctrlKey)) &&
      this.selectedNodes.length > 0
    ) {
      this.clearSelection();
      selectionChanged = true;
    }

    let ancestorElement = event.target as HTMLElement;
    while (
      ancestorElement.tagName !== "LI" ||
      (!ancestorElement.classList.contains("item") && !ancestorElement.classList.contains("group"))
    ) {
      if (ancestorElement === this.root) {
        return selectionChanged;
      }
      ancestorElement = ancestorElement.parentElement!;
    }

    const element = ancestorElement as HTMLLIElement;

    if (this.selectedNodes.length > 0 && this.selectedNodes[0].parentElement !== element.parentElement) {
      return selectionChanged;
    }

    if (this.multipleSelection && event.shiftKey && this.selectedNodes.length > 0) {
      const startElement = this.firstSelectedNode;
      const elements: HTMLLIElement[] = [];
      let inside = false;

      for (let i = 0; i < element.parentElement!.children.length; i++) {
        const child = element.parentElement!.children[i] as HTMLElement;

        if (child === startElement || child === element) {
          if (inside || startElement === element) {
            elements.push(child as HTMLLIElement);
            break;
          }
          inside = true;
        }

        if (inside && child.tagName === "LI") {
          elements.push(child as HTMLLIElement);
        }
      }

      this.clearSelection();
      this.selectedNodes = elements;
      this.firstSelectedNode = startElement;
      for (const selectedNode of this.selectedNodes) {
        selectedNode.classList.add("selected");
      }

      return true;
    }

    let index: number;
    if (event.ctrlKey && (index = this.selectedNodes.indexOf(element)) !== -1) {
      this.selectedNodes.splice(index, 1);
      element.classList.remove("selected");

      if (this.firstSelectedNode === element) {
        this.firstSelectedNode = this.selectedNodes[0];
      }

      return true;
    }

    this.addToSelection(element);

    return true;
  }

  private onDoubleClick = (event: MouseEvent) => {
    if (this.selectedNodes.length !== 1) {
      return;
    }

    const element = event.target as HTMLElement;
    if (element.tagName === "BUTTON" || element.tagName === "INPUT" || element.tagName === "SELECT") {
      return;
    }
    if (element.className === "toggle") {
      return;
    }

    this.dispatchEvent(new Event("activate"));
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (document.activeElement !== this.root) {
      return;
    }

    if (this.firstSelectedNode === null) {
      if (event.key === "ArrowDown") {
        this.addToSelection(this.root.firstElementChild as HTMLLIElement);
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
        if (this.selectedNodes.length !== 1) {
          return;
        }
        this.dispatchEvent(new Event("activate"));
        event.preventDefault();
        break;
    }
  };

  moveVertically(offset: number) {
    let node = this.firstSelectedNode;
    if (!node) {
      return;
    }

    if (offset === -1) {
      if (node.previousElementSibling) {
        let target = node.previousElementSibling as HTMLElement;

        while (target.classList.contains("children")) {
          if (!target.previousElementSibling!.classList.contains("collapsed") && target.childElementCount > 0) {
            target = target.lastElementChild as HTMLElement;
          }
          else {
            target = target.previousElementSibling as HTMLElement;
          }
        }
        node = target as HTMLLIElement;
      }
      else if (node.parentElement!.classList.contains("children")) {
        node = node.parentElement!.previousElementSibling as HTMLLIElement;
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
          node = node.nextElementSibling.firstElementChild as HTMLLIElement;
        }
        else if (node.nextElementSibling && node.nextElementSibling.nextElementSibling) {
          node = node.nextElementSibling.nextElementSibling as HTMLLIElement;
        }
        else {
          walkUp = true;
        }
      }
      else if (node.nextElementSibling) {
        node = node.nextElementSibling as HTMLLIElement;
      }
      else {
        walkUp = true;
      }

      if (walkUp) {
        if (node.parentElement && node.parentElement.classList.contains("children")) {
          let target = node.parentElement as HTMLElement;
          while (target.nextElementSibling === null) {
            target = target.parentElement!;
            if (!target.classList.contains("children")) {
              return;
            }
          }
          node = target.nextElementSibling as HTMLLIElement;
        }
        else {
          return;
        }
      }
    }

    if (node === null) {
      return;
    }

    this.clearSelection();
    this.addToSelection(node);
    this.scrollIntoView(node);
    this.dispatchEvent(new Event("selectionChange"));
  }

  moveHorizontally = (offset: number) => {
    let node = this.firstSelectedNode;
    if (!node) {
      return;
    }

    if (offset === -1) {
      if (!node.classList.contains("group") || node.classList.contains("collapsed")) {
        if (!node.parentElement!.classList.contains("children")) {
          return;
        }
        node = node.parentElement!.previousElementSibling as HTMLLIElement;
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

    this.clearSelection();
    this.addToSelection(node);
    this.scrollIntoView(node);
    this.dispatchEvent(new Event("selectionChange"));
  };

  private onDragStart = (event: DragEvent) => {
    const element = event.target as HTMLLIElement;
    if (!isGroup(element) && !isItem(element)) {
      return false;
    }

    if (this.selectedNodes.indexOf(element) === -1) {
      this.clearSelection();
      this.addToSelection(element);
      this.dispatchEvent(new Event("selectionChange"));
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

  private getDropLocation(
    event: DragEvent
  ): DropLocation | null {
    let element = event.target as HTMLElement;

    if (element.tagName === "OL" && element.classList.contains("children")) {
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
        target: element as HTMLLIElement,
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
        element.nextSibling &&
        (element.nextSibling as HTMLElement).tagName === "LI"
      ) {
        element = element.nextSibling as HTMLElement;
        where = "above";
      }
      else if (
        element.classList.contains("group") &&
        element.nextSibling &&
        element.nextSibling.nextSibling &&
        (element.nextSibling.nextSibling as HTMLElement).tagName === "LI"
      ) {
        element = element.nextSibling.nextSibling as HTMLElement;
        where = "above" as const;
      }
    }

    return {
      target: element as HTMLLIElement,
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
        (element.nextSibling as HTMLElement).childElementCount > 0) ? "inside" : "below";
    }

    return element.classList.contains("item") ? "below" : "inside";
  }

  private onDragOver = (event: DragEvent) => {
    const dropLocation = this.getDropLocation(event);

    // Prevent dropping onto null
    if (dropLocation === null) {
      return false;
    }

    // If we're dragging nodes from the current tree view
    // Prevent dropping into descendant
    if (this.isDraggingNodes) {
      if (dropLocation.where === "inside" && this.selectedNodes.indexOf(dropLocation.target as HTMLLIElement) !== -1) {
        return false;
      }

      for (const selectedNode of this.selectedNodes) {
        if (selectedNode.classList.contains("group") && (selectedNode.nextSibling as HTMLElement).contains(dropLocation.target)) {
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
      if (this.dropCallback) {
        this.dropCallback(event, dropLocation, []);
      }

      // eslint-disable-next-line consistent-return
      return false;
    }

    const children = this.selectedNodes[0].parentElement!.children;
    const orderedNodes: HTMLLIElement[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLLIElement;
      if (this.selectedNodes.indexOf(child) !== -1) {
        orderedNodes.push(child);
      }
    }

    const reparent = this.dropCallback ?
      this.dropCallback(event, dropLocation, orderedNodes) :
      true;
    if (!reparent) {
      return;
    }

    let newParent: HTMLElement | null = null;
    let referenceElt: HTMLElement | null;

    switch (dropLocation.where) {
      case "inside":
        if (!dropLocation.target.classList.contains("group")) {
          return;
        }

        newParent = dropLocation.target.nextSibling as HTMLElement;
        referenceElt = null;
        break;

      case "below":
        newParent = dropLocation.target.parentElement;
        referenceElt = dropLocation.target.nextSibling as HTMLElement;
        if (referenceElt && referenceElt.tagName === "OL") {
          referenceElt = referenceElt.nextSibling as HTMLElement;
        }
        break;

      case "above":
        newParent = dropLocation.target.parentElement;
        referenceElt = dropLocation.target;
        break;
    }

    let draggedChildren: HTMLElement | null = null;

    for (const selectedNode of orderedNodes) {
      if (selectedNode.classList.contains("group")) {
        draggedChildren = selectedNode.nextSibling as HTMLElement;
        draggedChildren.parentElement!.removeChild(draggedChildren);
      }

      if (referenceElt === selectedNode) {
        referenceElt = selectedNode.nextSibling as HTMLElement;
      }

      selectedNode.parentElement!.removeChild(selectedNode);
      newParent?.insertBefore(selectedNode, referenceElt);
      referenceElt = selectedNode.nextSibling as HTMLElement;

      if (draggedChildren) {
        newParent?.insertBefore(draggedChildren, referenceElt);
        referenceElt = draggedChildren.nextSibling as HTMLElement;
      }
    }

    return;
  };
}

function isGroup(
  element: HTMLElement | null
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
