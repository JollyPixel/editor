// CONSTANTS
const kSupportedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);
const kSupportedExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif"
]);

interface FileSystemEntryLike {
  isDirectory: boolean;
}

export function isDirectoryItem(
  item: DataTransferItem
): boolean {
  const itemWithEntry = item as DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntryLike | null;
  };

  return itemWithEntry.webkitGetAsEntry?.()?.isDirectory === true;
}

export function isSupportedFile(
  file: File
): boolean {
  if (kSupportedTypes.has(file.type.toLowerCase())) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  return file.type === "" && extension !== undefined && kSupportedExtensions.has(extension);
}

export function hasSupportedImageDrag(
  dataTransfer: DataTransfer | null
): boolean {
  if (!dataTransfer || [...dataTransfer.types].includes("text/uri-list")) {
    return false;
  }

  const fileItems = [...dataTransfer.items].filter((item) => item.kind === "file");
  if (fileItems.length > 0) {
    return fileItems.length === 1 &&
      !isDirectoryItem(fileItems[0]) &&
      kSupportedTypes.has(fileItems[0].type.toLowerCase());
  }

  return dataTransfer.files.length === 1 &&
    isSupportedFile(dataTransfer.files[0]);
}
