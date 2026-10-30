// Import Third-party Dependencies
import { TEXTURE_ASSET } from "@jolly-pixel/asset-server";
import type { EditorSession } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { TerrainEditing } from "../editing/TerrainEditing.ts";
import { TerrainExchange } from "../features/exchange/model/TerrainExchange.ts";
import { downloadFile } from "../features/exchange/panel/downloadFile.ts";
import "../features/exchange/panel/ExchangePanel.ts";
import { MaterialPalette } from "../features/materials/model/MaterialPalette.ts";
import { MaterialThumbnails } from "../features/materials/model/MaterialThumbnails.ts";
import { parentFolder } from "../features/materials/model/textureNames.ts";
import "../features/materials/panel/MaterialPalettePanel.ts";
import { PoiEditor } from "../features/poi/model/PoiEditor.ts";
import "../features/poi/panel/PoiPanel.ts";

// CONSTANTS
const kTextureFolder = "textures";

export function mountEditorPanels(
  session: EditorSession,
  editing: TerrainEditing,
  disposables: Array<() => void>
): void {
  mountMaterialPalette(session, editing, disposables);
  mountPoiPanel(editing, disposables);
  mountExchangePanel(session, editing, disposables);
}

function mountMaterialPalette(
  session: EditorSession,
  { document: terrain, history, selection, leases, overlaySettings }: TerrainEditing,
  disposables: Array<() => void>
): void {
  const element = document.querySelector("terrain-material-palette");
  if (element === null) {
    return;
  }

  const thumbnails = new MaterialThumbnails({
    document: terrain,
    leases,
    createUrl: (bytes) => URL.createObjectURL(new Blob([bytes.slice()])),
    revokeUrl: (url) => URL.revokeObjectURL(url)
  });
  const terrainFolder = parentFolder(session.target.record.path);
  const palette = new MaterialPalette({
    document: terrain,
    selection,
    history,
    catalog: session.catalog,
    importFolder: terrainFolder === "" ? kTextureFolder : `${terrainFolder}/${kTextureFolder}`,
    pickTexture: (title) => session.pickAsset({ kinds: [TEXTURE_ASSET], title }),
    askConflict: async(paths) => {
      const { askTextureConflict } = await import("../features/materials/panel/askTextureConflict.ts");

      return askTextureConflict(paths);
    }
  });
  element.context = { document: terrain, palette, selection, thumbnails, overlay: overlaySettings };
  disposables.push(() => {
    element.context = null;
    thumbnails.dispose();
  });
}

function mountPoiPanel(
  { document: terrain, history, poiSelection }: TerrainEditing,
  disposables: Array<() => void>
): void {
  const element = document.querySelector("terrain-poi-panel");
  if (element === null) {
    return;
  }

  const editor = new PoiEditor({ document: terrain, history, selection: poiSelection });
  element.context = { document: terrain, editor, selection: poiSelection };
  disposables.push(() => {
    element.context = null;
  });
}

function mountExchangePanel(
  session: EditorSession,
  { document: terrain, history }: TerrainEditing,
  disposables: Array<() => void>
): void {
  const element = document.querySelector("terrain-exchange-panel");
  if (element === null) {
    return;
  }

  const baseName = session.target.record.path.split("/").at(-1)!.split(".")[0];
  element.context = {
    document: terrain,
    exchange: new TerrainExchange({ document: terrain, history, baseName }),
    download: downloadFile
  };
  disposables.push(() => {
    element.context = null;
  });
}
