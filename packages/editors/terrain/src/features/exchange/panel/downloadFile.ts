// Import Internal Dependencies
import type { ExchangeFile } from "../model/TerrainExchange.ts";

export function downloadFile(
  { name, bytes }: ExchangeFile
): void {
  const url = URL.createObjectURL(new Blob([bytes.slice()]));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
