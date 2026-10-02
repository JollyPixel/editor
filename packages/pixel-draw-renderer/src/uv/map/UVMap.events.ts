// Import Internal Dependencies
import type { SelectionRect } from "../../types.ts";
import type {
  UVSlot,
  UVRegion,
  UVRegionData
} from "../region/UVRegion.ts";
import type { UVLabelScope } from "./UVMap.ts";

export type UVMapEvent = {
  changed: () => void;
  "region-created": (event: { region: UVRegion; }) => void;
  "region-deleted": (event: { region: UVRegion; }) => void;
  "region-moved": (event: {
    region: UVRegion;
    face: UVSlot | null;
    previousRect: SelectionRect;
  }) => void;
  "region-dragging": (event: {
    region: UVRegion;
    face: UVSlot | null;
  }) => void;
  "region-drag-ended": (event: {
    id: string;
    committed: boolean;
  }) => void;
  "region-state-changed": (event: {
    region: UVRegion;
    previous: UVRegionData;
  }) => void;
  "region-rotated": (event: {
    region: UVRegion;
    previous: UVRegionData;
    face: UVSlot | null;
  }) => void;
  "selection-changed": (event: {
    selectedRegionId: string | null;
    selectedSlot: UVSlot | null;
  }) => void;
  "visibility-changed": (event: { showAll: boolean; }) => void;
  "label-visibility-changed": (event: { showRegionLabels: boolean; }) => void;
  "label-scope-changed": (event: { labelScope: UVLabelScope; }) => void;
};

export type UVMapEventType = keyof UVMapEvent;

export type UVMapListener<T extends UVMapEventType = UVMapEventType> = UVMapEvent[T];
