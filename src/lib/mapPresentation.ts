import type { GeoPoint } from "./restaurantMap";

export type MapDetailMode = "overview" | "street";
export type MapLocationStatus = "idle" | "requesting" | "ready" | "blocked";
export type MapDiscoveryMode = "locating" | "location-required" | "nearby" | "browse";
export type MapCameraPlan =
  | { kind: "hold" }
  | { center: GeoPoint; kind: "center"; transition?: "flight"; zoom: number }
  | { kind: "fit"; maxZoom: number; points: GeoPoint[] };

export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
export const RESTAURANT_MARKER_POSITIONING = {
  anchor: "bottom",
  subpixelPositioning: true,
} as const;
export const STREET_DETAIL_MIN_ZOOM = 11;

const LAYER_MIN_ZOOM_OVERRIDES: Record<string, number> = {
  aeroway: 12,
  airport: 12,
  highway_minor: 11,
  highway_path: 13,
  label_other: 11,
  railway: 13,
  road_area_pier: 13,
  road_pier: 13,
  waterway_line_label: 11,
};

const FLAT_MAP_HIDDEN_LAYER_TERMS = [
  "aeroway",
  "airport",
  "building",
  "highway_name_minor",
  "highway_name_path",
  "highway_path",
  "highway_service",
  "house_number",
  "housenumber",
  "poi",
  "railway",
  "road_area",
  "road_name_minor",
  "road_name_path",
  "road_path",
  "road_pier",
  "road_service",
  "transit",
  "label_other",
];

export function getSimplifiedLayerMinZoom(layerId: string, currentMinZoom = 0): number {
  const configuredMinZoom = LAYER_MIN_ZOOM_OVERRIDES[layerId];
  return configuredMinZoom === undefined ? currentMinZoom : Math.max(currentMinZoom, configuredMinZoom);
}

export function shouldHideFlatMapLayer(layer: { id: string; type: string }): boolean {
  if (layer.type === "fill-extrusion") {
    return true;
  }

  const normalizedId = layer.id.toLowerCase().replaceAll("-", "_");
  return FLAT_MAP_HIDDEN_LAYER_TERMS.some((term) => normalizedId.includes(term));
}

export function getMapDetailMode(zoom: number): MapDetailMode {
  return zoom >= STREET_DETAIL_MIN_ZOOM ? "street" : "overview";
}

export function getMapDiscoveryMode(locationStatus: MapLocationStatus, browseAll = false): MapDiscoveryMode {
  if (locationStatus === "ready") {
    return "nearby";
  }

  if (locationStatus === "requesting") return "locating";
  return browseAll ? "browse" : "location-required";
}

export function getMapCameraPlan(options: {
  discoveryMode: MapDiscoveryMode;
  resultLocations: GeoPoint[];
  selectedLocation: GeoPoint | null;
  userAccuracyMeters?: number | null;
  userLocation: GeoPoint | null;
}): MapCameraPlan {
  if (options.selectedLocation) {
    return { center: options.selectedLocation, kind: "center", transition: "flight", zoom: 14.4 };
  }

  if (options.discoveryMode === "nearby" && options.userLocation) {
    return {
      center: options.userLocation,
      kind: "center",
      zoom: getNearbyMaxZoom(options.userAccuracyMeters),
    };
  }

  if (options.discoveryMode === "browse" && options.resultLocations.length) {
    return { kind: "fit", maxZoom: 14.4, points: options.resultLocations };
  }
  return { kind: "hold" };
}

function getNearbyMaxZoom(accuracyMeters: number | null | undefined): number {
  if (accuracyMeters !== null && accuracyMeters !== undefined && accuracyMeters > 2_000) {
    return 10.8;
  }

  if (accuracyMeters !== null && accuracyMeters !== undefined && accuracyMeters > 500) {
    return 12;
  }

  return 14.7;
}
