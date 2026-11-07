// Import Third-party Dependencies
import { saveFile } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ExchangeFile } from "../model/TerrainExchange.ts";

export function downloadFile(
  { name, bytes }: ExchangeFile
): void {
  saveFile(new Blob([bytes.slice()]), name);
}
