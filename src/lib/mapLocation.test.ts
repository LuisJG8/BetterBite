import { describe, expect, it } from "vitest";
import { createAccurateLocationResolver, MapLocationError } from "./mapLocation";

describe("accurate map location resolver", () => {
  it("shares one high-accuracy browser request across concurrent map mounts", async () => {
    const callbacks: { success?: PositionCallback } = {};
    let requestCount = 0;
    let requestedOptions: PositionOptions | undefined;
    const geolocation = {
      getCurrentPosition(nextSuccess: PositionCallback, _error?: PositionErrorCallback | null, options?: PositionOptions) {
        requestCount += 1;
        callbacks.success = nextSuccess;
        requestedOptions = options;
      },
    } as Pick<Geolocation, "getCurrentPosition">;
    const resolver = createAccurateLocationResolver();

    const firstRequest = resolver.getCurrentLocation(geolocation);
    const secondRequest = resolver.getCurrentLocation(geolocation);

    expect(requestCount).toBe(1);
    expect(requestedOptions).toEqual({ enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 });

    if (!callbacks.success) {
      throw new Error("Expected a geolocation success callback.");
    }
    callbacks.success({
      coords: {
        accuracy: 18,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: 30.2672,
        longitude: -97.7431,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 123,
      toJSON: () => ({}),
    });

    await expect(firstRequest).resolves.toEqual({
      accuracyMeters: 18,
      capturedAt: 123,
      latitude: 30.2672,
      longitude: -97.7431,
    });
    await expect(secondRequest).resolves.toEqual({
      accuracyMeters: 18,
      capturedAt: 123,
      latitude: 30.2672,
      longitude: -97.7431,
    });
  });

  it("rejects invalid browser coordinates instead of moving the map to a false location", async () => {
    const geolocation = {
      getCurrentPosition(success: PositionCallback) {
        success({
          coords: {
            accuracy: 25,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            latitude: 95,
            longitude: -97.7431,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: 123,
          toJSON: () => ({}),
        });
      },
    } as Pick<Geolocation, "getCurrentPosition">;

    await expect(createAccurateLocationResolver().getCurrentLocation(geolocation)).rejects.toThrow("invalid coordinates");
  });

  it.each([
    [1, "permission-denied"],
    [2, "position-unavailable"],
    [3, "timeout"],
  ] as const)("turns browser location error %s into the actionable %s failure", async (code, reason) => {
    const geolocation = {
      getCurrentPosition(_success: PositionCallback, error?: PositionErrorCallback | null) {
        error?.({ code, message: "Browser location failed." } as GeolocationPositionError);
      },
    } as Pick<Geolocation, "getCurrentPosition">;

    const request = createAccurateLocationResolver().getCurrentLocation(geolocation);

    await expect(request).rejects.toMatchObject({
      name: "MapLocationError",
      reason,
    });
    await expect(request).rejects.toBeInstanceOf(MapLocationError);
  });

  it("reuses a fresh location fix before asking the browser for GPS again", async () => {
    let now = 1_000;
    let requestCount = 0;
    const geolocation = {
      getCurrentPosition(success: PositionCallback) {
        requestCount += 1;
        success({
          coords: {
            accuracy: 12,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            latitude: 30.2672,
            longitude: -97.7431,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: now,
          toJSON: () => ({}),
        });
      },
    } as Pick<Geolocation, "getCurrentPosition">;
    const resolver = createAccurateLocationResolver({ now: () => now });

    await resolver.getCurrentLocation(geolocation);
    now += 30_000;
    await resolver.getCurrentLocation(geolocation);
    expect(requestCount).toBe(1);

    now += 31_000;
    await resolver.getCurrentLocation(geolocation);
    expect(requestCount).toBe(2);
  });
});
