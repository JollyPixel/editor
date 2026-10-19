// Import Third-party Dependencies
import {
  LocalStorageAdapter,
  LogQueue,
  type StorageAdapter
} from "@jolly-pixel/ui";
import {
  PixelArtKeyBindingSettings,
  UvNetLibrary
} from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import { BlockSelection } from "./BlockSelection.ts";
import { BrushStore } from "./BrushStore.ts";
import { EditContext } from "./EditContext.ts";
import { KeyboardLayoutStore } from "./KeyboardLayoutStore.ts";
import { PointerCapture } from "./PointerCapture.ts";
import { PresenceStore } from "./PresenceStore.ts";
import { SelectionStore } from "./SelectionStore.ts";
import { ToolStore } from "./ToolStore.ts";
import { TextureTabsStore } from "./TextureTabsStore.ts";
import { TemplatePreviewStore } from "./TemplatePreviewStore.ts";
import { UvSyncStore } from "./UvSyncStore.ts";
import { ViewStore } from "./ViewStore.ts";
import { MapKeyBindingSettings } from "../keybindings/MapKeyBindings.ts";
import { ShortcutLabels } from "../keybindings/ShortcutLabels.ts";
import {
  BLOCK_UV_NETS,
  DEFAULT_BLOCK_UV_NET
} from "../features/texture/uv/BlockUvNets.ts";

export interface EditorStateOptions {
  storage?: StorageAdapter;
}

export class EditorState {
  readonly selection = new SelectionStore();
  readonly editContext = new EditContext();
  readonly block = new BlockSelection();
  readonly tool = new ToolStore();
  readonly presence = new PresenceStore();
  readonly pointer = new PointerCapture();
  readonly log = new LogQueue();
  readonly keyboardLayout = new KeyboardLayoutStore();
  readonly view: ViewStore;
  readonly brush: BrushStore;
  readonly uvSync: UvSyncStore;
  readonly textureTabs: TextureTabsStore;
  readonly templatePreview: TemplatePreviewStore;
  readonly mapKeyBindings: MapKeyBindingSettings;
  readonly shortcuts: ShortcutLabels;
  readonly pixelArtKeyBindings: PixelArtKeyBindingSettings;
  readonly uvNets: UvNetLibrary;

  constructor(
    options: EditorStateOptions = {}
  ) {
    const {
      storage = new LocalStorageAdapter()
    } = options;

    this.view = new ViewStore(storage);
    this.brush = new BrushStore(storage);
    this.uvSync = new UvSyncStore(storage);
    this.textureTabs = new TextureTabsStore(storage);
    this.templatePreview = new TemplatePreviewStore(storage);
    this.mapKeyBindings = new MapKeyBindingSettings({
      storage,
      onDropped: (message) => this.log.push(message)
    });
    this.shortcuts = new ShortcutLabels(
      this.keyboardLayout,
      this.mapKeyBindings
    );
    this.pixelArtKeyBindings = new PixelArtKeyBindingSettings({
      storage,
      onDropped: (message) => this.log.push(message)
    });
    this.uvNets = new UvNetLibrary({
      storage,
      presets: BLOCK_UV_NETS,
      defaultId: DEFAULT_BLOCK_UV_NET
    });
  }
}
