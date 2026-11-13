export function saveFile(
  blob: Blob,
  fileName: string
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface PickFilesOptions {
  accept?: string;
  multiple?: boolean;
}

export function pickFiles(
  options: PickFilesOptions = {}
): Promise<File[]> {
  const { promise, resolve } = Promise.withResolvers<File[]>();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = options.accept ?? "";
  input.multiple = options.multiple ?? false;
  input.addEventListener("change", () => {
    resolve(Array.from(input.files ?? []));
  }, { once: true });
  input.addEventListener("cancel", () => resolve([]), { once: true });
  input.click();

  return promise;
}
