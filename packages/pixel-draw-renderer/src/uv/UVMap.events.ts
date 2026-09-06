// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";
import type {
  UVSlot,
  UVGeometry,
  UVRegion,
  UVRegionData
} from "./UVRegion.ts";

export type UVMapEvent = {
  "region-created": (event: { region: UVRegion; }) => void;
  "region-deleted": (event: { region: UVRegion; }) => void;
  "region-moved": (event: {
    region: UVRegion;
    face: UVSlot | null;
    previousRect: SelectionRect;
  }) => void;
  "region-dragging": (event: {
    id: string;
    face: UVSlot | null;
    rect: SelectionRect;
    geometry: UVGeometry;
  }) => void;
  "region-state-changed": (event: {
    region: UVRegion;
    previous: UVRegionData;
  }) => void;
  "selection-changed": (event: {
    selectedRegionId: string | null;
    selectedFace: UVSlot | null;
  }) => void;
  "visibility-changed": (event: { showAll: boolean; }) => void;
  "label-visibility-changed": (event: { showRegionLabels: boolean; }) => void;
};

export type UVMapEventType = keyof UVMapEvent;

export type UVMapListener<T extends UVMapEventType = UVMapEventType> = UVMapEvent[T];
