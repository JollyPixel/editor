// Import Internal Dependencies
import { peerColor } from "../../../src/index.ts";
import type { GalleryExample } from "../types.ts";

// CONSTANTS
const kPeerCount = 16;
const kCycleMs = 900;

/**
 * Owns a real interval, so a shell that skipped disposal would leave a timer mutating a detached
 * tree. That is the half of `GalleryExample` one example cannot cover.
 */
export const PEER_COLORS_EXAMPLE: GalleryExample = {
  id: "foundation/peer-colors",
  title: "Peer colours",
  group: "Foundation",
  render(host) {
    const row = document.createElement("div");
    row.className = "peer-row";

    const chips = Array.from({ length: kPeerCount }, (_, index) => {
      const chip = document.createElement("span");
      chip.className = "peer-chip";
      chip.style.background = peerColor(index);
      chip.textContent = String(index);
      row.append(chip);

      return chip;
    });

    host.append(row);

    let active = 0;
    const timer = setInterval(() => {
      chips[active].classList.remove("is-active");
      active = (active + 1) % chips.length;
      chips[active].classList.add("is-active");
    }, kCycleMs);
    chips[0].classList.add("is-active");

    return () => clearInterval(timer);
  }
};
