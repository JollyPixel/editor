// Import Third-party Dependencies
import type { AssetKindIcon } from "@jolly-pixel/asset-server";

// CONSTANTS
export const BLOCKSET_ICON: AssetKindIcon = {
  svg: `
    <rect x="7" y="7" width="50" height="50" rx="6" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <rect x="7" y="7" width="50" height="50" rx="6" fill="#2b1d16" />
    <rect x="10" y="10" width="21" height="21" rx="3" fill="#b8743d" />
    <path d="M10 13 a3 3 0 0 1 3 -3 H28 a3 3 0 0 1 3 3 V19 H10 Z" fill="#74de4f" />
    <rect x="33" y="10" width="21" height="21" rx="3" fill="#4fc3ff" />
    <path d="M37 21 q3.5 -3 7 0 t7 0" fill="none" stroke="#e6f8ff" stroke-width="2.6" stroke-linecap="round" />
    <rect x="10" y="33" width="21" height="21" rx="3" fill="#ff6a4d" />
    <path d="M10 43.5 H31 M20.5 33 V43.5" stroke="#c4422a" stroke-width="2" />
    <rect x="33" y="33" width="21" height="21" rx="3" fill="#a3acb6" />
    <rect x="36" y="36" width="8" height="6" rx="2" fill="#c7ced6" />
  `,
  viewBox: "0 0 64 64"
};

export const VOXEL_MAP_ICON: AssetKindIcon = {
  svg: `
    <polygon points="20,26 32,32 32,44 20,38" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="32,32 44,26 44,38 32,44" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="32,20 44,26 32,32 20,26" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="20,14 32,20 32,32 20,26" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="32,20 44,14 44,26 32,32" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="32,8 44,14 32,20 20,14" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="32,32 44,38 44,50 32,44" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="44,38 56,32 56,44 44,50" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="44,26 56,32 44,38 32,32" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="8,32 20,38 20,50 8,44" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="20,38 32,32 32,44 20,50" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="20,26 32,32 20,38 8,32" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="20,38 32,44 32,56 20,50" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="32,44 44,38 44,50 32,56" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="32,32 44,38 32,44 20,38" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <polygon points="20,26 32,32 32,44 20,38" fill="#b8743d" stroke="#81512b" stroke-width="1" stroke-linejoin="round" />
    <polygon points="32,32 44,26 44,38 32,44" fill="#93582b" stroke="#673e1e" stroke-width="1" stroke-linejoin="round" />
    <polygon points="32,20 44,26 32,32 20,26" fill="#c98a52" stroke="#519b37" stroke-width="1" stroke-linejoin="round" />
    <polygon points="20,14 32,20 32,32 20,26" fill="#b8743d" stroke="#81512b" stroke-width="1" stroke-linejoin="round" />
    <polygon points="32,20 44,14 44,26 32,32" fill="#93582b" stroke="#673e1e" stroke-width="1" stroke-linejoin="round" />
    <polygon points="20,14 32,20 32,24 20,18" fill="#56c23a" />
    <polygon points="32,20 44,14 44,18 32,24" fill="#43a12c" />
    <polygon points="32,8 44,14 32,20 20,14" fill="#74de4f" stroke="#519b37" stroke-width="1" stroke-linejoin="round" />
    <polygon points="32,32 44,38 44,50 32,44" fill="#b8743d" stroke="#81512b" stroke-width="1" stroke-linejoin="round" />
    <polygon points="44,38 56,32 56,44 44,50" fill="#93582b" stroke="#673e1e" stroke-width="1" stroke-linejoin="round" />
    <polygon points="32,32 44,38 44,42 32,36" fill="#56c23a" />
    <polygon points="44,38 56,32 56,36 44,42" fill="#43a12c" />
    <polygon points="44,26 56,32 44,38 32,32" fill="#74de4f" stroke="#519b37" stroke-width="1" stroke-linejoin="round" />
    <polygon points="8,32 20,38 20,50 8,44" fill="#b8743d" stroke="#81512b" stroke-width="1" stroke-linejoin="round" />
    <polygon points="20,38 32,32 32,44 20,50" fill="#93582b" stroke="#673e1e" stroke-width="1" stroke-linejoin="round" />
    <polygon points="8,32 20,38 20,42 8,36" fill="#56c23a" />
    <polygon points="20,38 32,32 32,36 20,42" fill="#43a12c" />
    <polygon points="20,26 32,32 20,38 8,32" fill="#74de4f" stroke="#519b37" stroke-width="1" stroke-linejoin="round" />
    <polygon points="20,38 32,44 32,56 20,50" fill="#b8743d" stroke="#81512b" stroke-width="1" stroke-linejoin="round" />
    <polygon points="32,44 44,38 44,50 32,56" fill="#93582b" stroke="#673e1e" stroke-width="1" stroke-linejoin="round" />
    <polygon points="20,38 32,44 32,48 20,42" fill="#56c23a" />
    <polygon points="32,44 44,38 44,42 32,48" fill="#43a12c" />
    <polygon points="32,32 44,38 32,44 20,38" fill="#74de4f" stroke="#519b37" stroke-width="1" stroke-linejoin="round" />
  `,
  viewBox: "0 0 64 64"
};
