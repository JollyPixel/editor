// Import Third-party Dependencies
import type {
  Island,
  IslandMap,
  NormalMapConfig,
  NormalMapZone,
  UVRegion
} from "@jolly-pixel/pixel-draw.renderer";

export interface NormalMapZoneRow {
  readonly zone: Readonly<NormalMapZone>;
  readonly region: UVRegion | null;
  readonly name: string;
  readonly sharedWith: readonly string[];
}

export interface NormalMapWrapFallback {
  readonly islands: number;
  readonly remainder: boolean;
}

export class NormalMapOverview {
  readonly zones: readonly NormalMapZoneRow[];

  readonly #config: NormalMapConfig;
  readonly #islands: IslandMap;

  constructor(
    config: NormalMapConfig,
    regions: Iterable<UVRegion>,
    islands: IslandMap
  ) {
    this.#config = config;
    this.#islands = islands;

    const byId = new Map<string, UVRegion>();
    for (const region of regions) {
      byId.set(region.id, region);
    }
    this.zones = config.zones.map((zone) => {
      const region = byId.get(zone.regionId) ?? null;

      return {
        zone,
        region,
        name: region === null ? zone.regionId : region.name ?? region.id,
        sharedWith: region === null ?
          [] :
          this.#winnersOver(zone, byId)
      };
    });
  }

  zoneOf(
    regionId: string
  ): NormalMapZoneRow | undefined {
    return this.zones.find(
      (row) => row.zone.regionId === regionId
    );
  }

  wrapFallback(
    regionId: string | null
  ): NormalMapWrapFallback {
    let islands = 0;
    let remainder = false;
    for (const island of this.#islands.islands) {
      if (
        island.isRect ||
        !this.#governs(island, regionId) ||
        this.#borderOf(island) !== "wrap"
      ) {
        continue;
      }

      if (island.isRemainder) {
        remainder = true;
      }
      else {
        islands++;
      }
    }

    return {
      islands,
      remainder
    };
  }

  #governs(
    island: Island,
    regionId: string | null
  ): boolean {
    const winner = this.#config.winningZone(
      island.regionIds
    );

    return regionId === null ?
      winner === undefined :
      winner?.regionId === regionId;
  }

  #borderOf(
    island: Island
  ): string | null {
    const settings = this.#config.resolve(
      island.regionIds
    );

    return settings === "off" ? null : settings.border;
  }

  #winnersOver(
    zone: Readonly<NormalMapZone>,
    regions: ReadonlyMap<string, UVRegion>
  ): string[] {
    const names = new Set<string>();
    for (const island of this.#islands.islandsOf(zone.regionId)) {
      const winner = this.#config.winningZone(island.regionIds);
      if (winner !== undefined && winner.regionId !== zone.regionId) {
        const region = regions.get(winner.regionId);
        names.add(region?.name ?? winner.regionId);
      }
    }

    return [...names];
  }
}
