import { describe, expect, it } from "vitest";
import {
  getMapCameraPlan,
  getMapDetailMode,
  getMapDiscoveryMode,
  getSimplifiedLayerMinZoom,
  RESTAURANT_MARKER_POSITIONING,
  shouldHideFlatMapLayer,
} from "./mapPresentation";

describe("map presentation policy", () => {
  it("keeps restaurant logo pins on their exact projected coordinate while the map zooms", () => {
    expect(RESTAURANT_MARKER_POSITIONING).toEqual({
      anchor: "bottom",
      subpixelPositioning: true,
    });
  });

  it("keeps overview labels while delaying local map clutter", () => {
    expect(getSimplifiedLayerMinZoom("label_city", 3)).toBe(3);
    expect(getSimplifiedLayerMinZoom("highway_motorway_inner", 6)).toBe(6);
    expect(getSimplifiedLayerMinZoom("label_other", 8)).toBe(11);
    expect(getSimplifiedLayerMinZoom("highway_minor", 8)).toBe(11);
    expect(getSimplifiedLayerMinZoom("highway-name-minor", 15)).toBe(15);
  });

  it("removes 3D buildings and low-value neighborhood clutter", () => {
    expect(shouldHideFlatMapLayer({ id: "building-3d", type: "fill-extrusion" })).toBe(true);
    expect(shouldHideFlatMapLayer({ id: "building", type: "fill" })).toBe(true);
    expect(shouldHideFlatMapLayer({ id: "poi-r20", type: "symbol" })).toBe(true);
    expect(shouldHideFlatMapLayer({ id: "road-service", type: "line" })).toBe(true);
    expect(shouldHideFlatMapLayer({ id: "highway-name-minor", type: "symbol" })).toBe(true);
    expect(shouldHideFlatMapLayer({ id: "label-other", type: "symbol" })).toBe(true);
    expect(shouldHideFlatMapLayer({ id: "railway-transit", type: "line" })).toBe(true);
    expect(shouldHideFlatMapLayer({ id: "water", type: "fill" })).toBe(false);
    expect(shouldHideFlatMapLayer({ id: "park", type: "fill" })).toBe(false);
    expect(shouldHideFlatMapLayer({ id: "highway-major-inner", type: "line" })).toBe(false);
    expect(shouldHideFlatMapLayer({ id: "label-city", type: "symbol" })).toBe(false);
  });

  it("switches from overview to street detail at neighborhood zoom", () => {
    expect(getMapDetailMode(6)).toBe("overview");
    expect(getMapDetailMode(10.9)).toBe("overview");
    expect(getMapDetailMode(11)).toBe("street");
    expect(getMapDetailMode(15)).toBe("street");
  });

  it("requires a user location before entering nearby discovery", () => {
    expect(getMapDiscoveryMode("idle")).toBe("location-required");
    expect(getMapDiscoveryMode("requesting")).toBe("locating");
    expect(getMapDiscoveryMode("blocked")).toBe("location-required");
    expect(getMapDiscoveryMode("ready")).toBe("nearby");
  });

  it("shows the catalog without device coordinates only after browsing is chosen", () => {
    expect(getMapDiscoveryMode("blocked", true)).toBe("browse");
    const resultLocations = [{ latitude: 41.89, longitude: -87.63 }];
    expect(getMapCameraPlan({ discoveryMode: "browse", resultLocations, selectedLocation: null, userLocation: null }))
      .toEqual({ kind: "fit", maxZoom: 14.4, points: resultLocations });
  });

  it("holds the camera instead of fitting restaurant results without a user location", () => {
    expect(
      getMapCameraPlan({
        discoveryMode: "locating",
        resultLocations: [{ latitude: 30.2672, longitude: -97.7431 }],
        selectedLocation: null,
        userLocation: null,
      }),
    ).toEqual({ kind: "hold" });
  });

  it("keeps the user centered at a close neighborhood scale even when nearby results exist", () => {
    const userLocation = { latitude: 30.2672, longitude: -97.7431 };
    const nearbyLocation = { latitude: 30.3072, longitude: -97.7431 };

    expect(
      getMapCameraPlan({
        discoveryMode: "nearby",
        resultLocations: [],
        selectedLocation: null,
        userLocation,
      }),
    ).toEqual({ center: userLocation, kind: "center", zoom: 14.7 });

    expect(
      getMapCameraPlan({
        discoveryMode: "nearby",
        resultLocations: [nearbyLocation],
        selectedLocation: null,
        userLocation,
      }),
    ).toEqual({ center: userLocation, kind: "center", zoom: 14.7 });
  });

  it("does not over-zoom when the browser reports an approximate location", () => {
    const userLocation = { latitude: 30.2672, longitude: -97.7431 };

    expect(
      getMapCameraPlan({
        discoveryMode: "nearby",
        resultLocations: [],
        selectedLocation: null,
        userAccuracyMeters: 2_500,
        userLocation,
      }),
    ).toEqual({ center: userLocation, kind: "center", zoom: 10.8 });
  });

  it("does not create a national camera plan when location is required", () => {
    expect(
      getMapCameraPlan({
        discoveryMode: "location-required",
        resultLocations: [
          { latitude: 34.0599, longitude: -118.4194 },
          { latitude: 38.9802, longitude: -77.0924 },
        ],
        selectedLocation: null,
        userLocation: null,
      }),
    ).toEqual({ kind: "hold" });
  });

  it("flies to a restaurant after the user explicitly selects its marker", () => {
    const userLocation = { latitude: 30.2672, longitude: -97.7431 };
    const selectedLocation = { latitude: 30.3072, longitude: -97.7431 };

    expect(
      getMapCameraPlan({
        discoveryMode: "nearby",
        resultLocations: [selectedLocation],
        selectedLocation,
        userLocation,
      }),
    ).toEqual({ center: selectedLocation, kind: "center", transition: "flight", zoom: 14.4 });
  });
});
