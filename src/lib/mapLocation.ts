import type { GeoPoint } from "./restaurantMap";

export interface AccurateMapLocation extends GeoPoint {
  accuracyMeters: number;
  capturedAt: number;
}

export type MapLocationFailureReason =
  | "invalid-response"
  | "permission-denied"
  | "position-unavailable"
  | "timeout";

export class MapLocationError extends Error {
  readonly reason: MapLocationFailureReason;

  constructor(reason: MapLocationFailureReason, message: string) {
    super(message);
    this.name = "MapLocationError";
    this.reason = reason;
  }
}

export const ACCURATE_LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 60_000,
  timeout: 10_000,
};

export function createAccurateLocationResolver({
  cacheDurationMs = 60_000,
  now = () => Date.now(),
}: {
  cacheDurationMs?: number;
  now?: () => number;
} = {}) {
  let cachedLocation: { location: AccurateMapLocation; resolvedAt: number } | null = null;
  let inFlightRequest: Promise<AccurateMapLocation> | null = null;

  return {
    getCurrentLocation(
      geolocation: Pick<Geolocation, "getCurrentPosition">,
      { forceRefresh = false }: { forceRefresh?: boolean } = {},
    ): Promise<AccurateMapLocation> {
      const requestedAt = now();
      if (!forceRefresh && cachedLocation && requestedAt - cachedLocation.resolvedAt <= cacheDurationMs) {
        return Promise.resolve(cachedLocation.location);
      }

      if (inFlightRequest) {
        return inFlightRequest;
      }

      const request = new Promise<AccurateMapLocation>((resolve, reject) => {
        geolocation.getCurrentPosition(
          (position) => {
            if (!isValidLocationPosition(position)) {
              reject(new MapLocationError("invalid-response", "Location provider returned invalid coordinates."));
              return;
            }

            const location: AccurateMapLocation = {
              accuracyMeters: position.coords.accuracy,
              capturedAt: position.timestamp,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            if (cacheDurationMs > 0) cachedLocation = { location, resolvedAt: now() };
            resolve(location);
          },
          (error) => reject(toMapLocationError(error)),
          ACCURATE_LOCATION_OPTIONS,
        );
      });

      inFlightRequest = request.finally(() => {
        inFlightRequest = null;
      });
      return inFlightRequest;
    },
  };
}

// The map owns its permission-aware session cache. Only deduplicate active GPS requests here.
export const mapLocationResolver = createAccurateLocationResolver({ cacheDurationMs: 0 });

export function getMapLocationFailureReason(error: unknown): MapLocationFailureReason {
  return error instanceof MapLocationError ? error.reason : "position-unavailable";
}

function toMapLocationError(error: GeolocationPositionError): MapLocationError {
  switch (error.code) {
    case 1:
      return new MapLocationError("permission-denied", "Location access is blocked.");
    case 3:
      return new MapLocationError("timeout", "Location request timed out.");
    case 2:
    default:
      return new MapLocationError("position-unavailable", "The browser could not determine this device's location.");
  }
}

function isValidLocationPosition(position: GeolocationPosition): boolean {
  const { accuracy, latitude, longitude } = position.coords;
  return (
    Number.isFinite(position.timestamp) && position.timestamp > 0 &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(accuracy) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    accuracy >= 0
  );
}
