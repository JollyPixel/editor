export function isInputElement(
  target: EventTarget | null
): target is HTMLInputElement {
  return target instanceof HTMLInputElement;
}

export function downloadBlob(
  blob: Blob,
  name: string
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
