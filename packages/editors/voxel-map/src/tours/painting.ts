// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { uvBlocksets } from "./uvBlocksets.ts";
import { TourHooks } from "./support/TourHooks.ts";

// CONSTANTS
const kPaint = TourHooks.textureMode("paint", "paint");

export const painting = new Tour({
  id: "voxel-map.painting",
  version: 1,
  title: "Painting textures",
  steps: [
    {
      id: "welcome",
      title: "Painting textures",
      body: "The Paint tab gives the blockset texture the whole panel. " +
        "The same tools work in the smaller texture under the block library."
    },
    {
      id: "modes",
      target: TourHooks.texture("mode-rail"),
      side: "right",
      title: "Tools",
      body: "Move pans the view. Paint, Erase and Fill change pixels, " +
        "and Select grabs an area to copy or transform.\n\n" +
        "Hover a tool for its options: Paint becomes a color picker, " +
        "Fill fills every matching pixel or only touching ones, " +
        "and Clip to UV keeps a fill inside a block's region.",
      enter: kPaint
    },
    {
      id: "brush",
      target: TourHooks.texture("[part=top-row]"),
      side: "below",
      title: "Brush size",
      body: "Size sets the width of Paint and Erase, and so does `Ctrl` + wheel.\n\n" +
        "Hold `Shift` while painting to draw a straight line.",
      enter: kPaint
    },
    {
      id: "colors",
      target: TourHooks.texture("[part=color-picker]"),
      side: "right",
      title: "Colors",
      body: "Left click paints with the first color and right click with the second. " +
        "Click a swatch to change it, or swap the two.\n\n" +
        "The dock button opens a full picker with a palette: " +
        "`Shift` + click a palette slot builds a ramp from the current color, " +
        "and a double click edits it.",
      enter: kPaint
    },
    {
      id: "select",
      target: TourHooks.texture("[part=top-row]"),
      side: "below",
      title: "Selection",
      body: "With Select, this bar copies, pastes an image, rotates, flips or deletes the selection.\n\n" +
        "`{pixelart.copy}` and `{pixelart.paste}` copy and paste, `{pixelart.rotate}` rotates, " +
        "`{pixelart.flipHorizontal}` and `{pixelart.flipVertical}` flip.",
      enter: TourHooks.textureMode("select", "paint")
    },
    {
      id: "navigation",
      target: TourHooks.texture("[part=stage]"),
      side: "left",
      title: "Zoom and pan",
      body: "The wheel zooms around the cursor. Drag with the middle button, " +
        "or hold `Space` and drag, to pan.\n\n" +
        "Texture shortcuts work while the cursor is over the texture.",
      enter: kPaint
    },
    {
      id: "view-options",
      target: TourHooks.texture("[part=view-options-button]"),
      side: "below",
      title: "View options",
      body: "Show the pixel grid, and the outline, name or size of each block region.",
      enter: kPaint
    },
    {
      id: "file",
      target: TourHooks.texture("[part=history-file-toolbar]"),
      side: "above",
      title: "History and files",
      body: "The texture has its own undo history, separate from the map.\n\n" +
        "Import a PNG, or drop one on the texture. Export it, or clear it.",
      enter: kPaint
    },
    {
      id: "normal-map",
      target: TourHooks.texture("[part=normal-map-dock-button]"),
      side: "above",
      title: "Normal map",
      body: "A normal map gives the texture relief under the lights. " +
        "Turn one on here, then tune its height, bevel and edges.",
      enter: kPaint
    },
    REPLAY_TOUR_STEP
  ],
  followUp: uvBlocksets
});
