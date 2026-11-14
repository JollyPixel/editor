// Import Third-party Dependencies
import type { OpenAssets } from "@jolly-pixel/server";
import type {
  PresencePeer,
  TreeBadge
} from "@jolly-pixel/ui";

// CONSTANTS
const kMaxBadges = 3;
const kNamedOccupants = 3;
const kBackgroundTint = 40;
const kNoOccupants: readonly AssetOccupant[] = Object.freeze([]);

export type AssetVisit = readonly [peer: PresencePeer, assets: OpenAssets];

export interface AssetOccupant {
  readonly peer: PresencePeer;
  readonly focused: boolean;
}

export class AssetOccupancy {
  static readonly EMPTY = new AssetOccupancy([]);

  #byAsset = new Map<string, AssetOccupant[]>();

  constructor(
    visits: Iterable<AssetVisit>
  ) {
    for (const [peer, { open, focused }] of visits) {
      const assetIds = new Set(focused === null ? open : [focused, ...open]);
      for (const assetId of assetIds) {
        const occupant: AssetOccupant = {
          peer,
          focused: assetId === focused
        };
        const occupants = this.#byAsset.get(assetId);
        if (occupants === undefined) {
          this.#byAsset.set(assetId, [occupant]);
        }
        else {
          occupants.push(occupant);
        }
      }
    }
    for (const occupants of this.#byAsset.values()) {
      occupants.sort(compareOccupants);
    }
  }

  get isEmpty(): boolean {
    return this.#byAsset.size === 0;
  }

  occupants(
    assetId: string
  ): readonly AssetOccupant[] {
    return this.#byAsset.get(assetId) ?? kNoOccupants;
  }

  removalWarning(
    assetIds: readonly string[]
  ): string | null {
    const names = new Set(assetIds.flatMap(
      (assetId) => this.occupants(assetId).map(({ peer }) => peer.displayName)
    ));
    if (names.size === 0) {
      return null;
    }

    const named = [...names]
      .sort((left, right) => left.localeCompare(right))
      .slice(0, kNamedOccupants);
    const others = names.size - named.length;
    if (others > 0) {
      named.push(others === 1 ? "1 other" : `${others} others`);
    }
    const last = named.pop();
    const list = named.length === 0 ? last : `${named.join(", ")} and ${last}`;
    const verb = names.size === 1 ? "has" : "have";
    const subject = assetIds.length === 1 ? "it" : "some of them";

    return `${list} ${verb} ${subject} open: their editor will close.`;
  }

  badges(
    assetId: string
  ): TreeBadge[] {
    return this.occupants(assetId)
      .slice(0, kMaxBadges)
      .map(({ peer, focused }) => {
        return {
          color: focused ?
            peer.color :
            `color-mix(in oklab, ${peer.color} ${kBackgroundTint}%, transparent)`,
          title: `${peer.displayName} · ${occupantState(focused)}`
        };
      });
  }
}

export function occupantState(
  focused: boolean
): string {
  return focused ? "Editing" : "Open";
}

function compareOccupants(
  left: AssetOccupant,
  right: AssetOccupant
): number {
  return Number(right.focused) - Number(left.focused) ||
    left.peer.displayName.localeCompare(right.peer.displayName);
}
