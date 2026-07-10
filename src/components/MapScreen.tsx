import "maplibre-gl/dist/maplibre-gl.css";

import { AlertTriangle, CheckCircle2, Heart, Leaf, Loader2, LocateFixed, Search, SlidersHorizontal, Star } from "lucide-react";
import maplibregl, { AttributionControl, Marker, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_NEARBY_RADIUS_MILES,
  RESTAURANT_DIET_FILTERS,
  filterHealthyRestaurants,
  getMapCenterForLocationState,
  type GeoPoint,
  type RestaurantDietFilter,
  type RestaurantMapResult,
} from "../lib/restaurantMap";

type LocationStatus = "idle" | "requesting" | "ready" | "blocked";

const DEFAULT_MAP_ZOOM = 3.3;
const NEARBY_MAP_ZOOM = 12.2;
const SELECTED_MAP_ZOOM = 13.4;
const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL?.trim();
let didAutoRequestLocationThisRuntime = false;

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

export function MapScreen() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const restaurantMarkersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const restaurantCardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [query, setQuery] = useState("");
  const [selectedDietFilters, setSelectedDietFilters] = useState<RestaurantDietFilter[]>([]);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  const restaurants = useMemo(
    () =>
      filterHealthyRestaurants({
        selectedDietFilters,
        query,
        userLocation,
        maxDistanceMiles: locationStatus === "ready" ? DEFAULT_NEARBY_RADIUS_MILES : Number.POSITIVE_INFINITY,
      }),
    [locationStatus, query, selectedDietFilters, userLocation],
  );
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null;
  const mapCenter = selectedRestaurant?.coordinates ?? getMapCenterForLocationState(userLocation, restaurants);
  const hasActiveFilters = selectedDietFilters.length > 0 || query.trim().length > 0;
  const mapZoom = selectedRestaurant ? SELECTED_MAP_ZOOM : restaurants.length > 0 || userLocation ? NEARBY_MAP_ZOOM : DEFAULT_MAP_ZOOM;

  const clearRestaurantMarkers = useCallback(() => {
    for (const marker of restaurantMarkersRef.current) {
      marker.remove();
    }
    restaurantMarkersRef.current = [];
  }, []);

  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("blocked");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("ready");
      },
      () => {
        setLocationStatus("blocked");
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 6500 },
    );
  }, []);

  useEffect(() => {
    if (didAutoRequestLocationThisRuntime) {
      return;
    }

    didAutoRequestLocationThisRuntime = true;
    requestUserLocation();
  }, [requestUserLocation]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      attributionControl: false,
      center: toLngLat(mapCenter),
      container: mapContainerRef.current,
      style: MAP_STYLE_URL || OSM_RASTER_STYLE,
      zoom: mapZoom,
    });

    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;

    map.once("load", () => {
      map.resize();
    });

    window.setTimeout(() => map.resize(), 100);

    return () => {
      clearRestaurantMarkers();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [clearRestaurantMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.easeTo({
      center: toLngLat(mapCenter),
      duration: 650,
      essential: true,
      zoom: mapZoom,
    });
  }, [mapCenter.latitude, mapCenter.longitude, mapZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    clearRestaurantMarkers();
    restaurantMarkersRef.current = restaurants.map((restaurant) => {
      const markerElement = createRestaurantMarkerElement(restaurant, restaurant.id === selectedRestaurantId);
      markerElement.addEventListener("click", () => setSelectedRestaurantId(restaurant.id));
      return new Marker({ anchor: "bottom", element: markerElement }).setLngLat(toLngLat(restaurant.coordinates)).addTo(map);
    });
  }, [clearRestaurantMarkers, restaurants, selectedRestaurantId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!userLocation) {
      return;
    }

    userMarkerRef.current = new Marker({ anchor: "center", element: createUserMarkerElement() }).setLngLat(toLngLat(userLocation)).addTo(map);
  }, [userLocation]);

  useEffect(() => {
    if (selectedRestaurantId && !restaurants.some((restaurant) => restaurant.id === selectedRestaurantId)) {
      setSelectedRestaurantId(restaurants[0]?.id ?? null);
    }
  }, [restaurants, selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId) {
      return;
    }

    restaurantCardRefs.current.get(selectedRestaurantId)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedRestaurantId]);

  function setRestaurantCardRef(id: string) {
    return (node: HTMLButtonElement | null) => {
      if (node) {
        restaurantCardRefs.current.set(id, node);
        return;
      }

      restaurantCardRefs.current.delete(id);
    };
  }

  function toggleDietFilter(filter: RestaurantDietFilter) {
    setSelectedDietFilters((currentFilters) =>
      currentFilters.includes(filter) ? currentFilters.filter((currentFilter) => currentFilter !== filter) : [...currentFilters, filter],
    );
  }

  function clearFilters() {
    setQuery("");
    setSelectedDietFilters([]);
  }

  return (
    <div className="betterbite-map-shell relative h-full min-h-full overflow-hidden bg-[#E9EEF0]" data-swipe-ignore="true">
      <div ref={mapContainerRef} className="betterbite-map-canvas absolute inset-0" aria-label="BetterBite healthy restaurant map" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(248,250,251,0.92)_0%,rgba(248,250,251,0.4)_18%,rgba(248,250,251,0)_42%),linear-gradient(0deg,rgba(248,250,251,0.88)_0%,rgba(248,250,251,0.24)_28%,rgba(248,250,251,0)_52%)]" />

      <div className="absolute inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10 space-y-3" data-swipe-ignore="true">
        <div className="flex items-center gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search healthy restaurants</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#191C1D]" size={19} strokeWidth={2.7} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-14 w-full rounded-full border border-white/90 bg-white/95 px-12 text-[16px] font-bold leading-5 text-[#191C1D] shadow-[0_10px_26px_rgba(0,31,33,0.14)] outline-none transition placeholder:text-[#717B7D] focus:border-[#00A8AB] focus:ring-4 focus:ring-[#00C5C8]/20"
              placeholder="Search healthy restaurants"
              type="search"
            />
          </label>
          <button
            type="button"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white text-[#111314] shadow-[0_10px_24px_rgba(0,31,33,0.16)] transition active:scale-95 disabled:cursor-not-allowed disabled:text-[#7A8587] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/45"
            onClick={requestUserLocation}
            disabled={locationStatus === "requesting"}
            aria-label="Use my location"
          >
            {locationStatus === "requesting" ? <Loader2 className="animate-spin" size={21} /> : <LocateFixed size={21} strokeWidth={2.7} />}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Restaurant map filters">
          {RESTAURANT_DIET_FILTERS.map((filter) => {
            const isSelected = selectedDietFilters.includes(filter.id);
            return (
              <button
                key={filter.id}
                type="button"
                className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-black shadow-[0_8px_18px_rgba(0,31,33,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 ${
                  isSelected ? "border-[#111314] bg-[#111314] text-white" : "border-white/90 bg-white/95 text-[#191C1D] hover:bg-white"
                }`}
                aria-pressed={isSelected}
                onClick={() => toggleDietFilter(filter.id)}
              >
                <Leaf size={15} strokeWidth={2.6} />
                {filter.label}
              </button>
            );
          })}
          {hasActiveFilters && (
            <button
              type="button"
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/90 bg-white/95 px-3.5 text-[13px] font-black text-[#191C1D] shadow-[0_8px_18px_rgba(0,31,33,0.12)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
              onClick={clearFilters}
            >
              <SlidersHorizontal size={15} strokeWidth={2.4} />
              Clear
            </button>
          )}
        </div>

        <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-[#111314] px-4 py-2 text-[12px] font-black leading-4 text-white shadow-[0_12px_26px_rgba(0,0,0,0.24)]">
          <span>{getLocationCopy(locationStatus, restaurants.length)}</span>
          <span className="h-1 w-1 rounded-full bg-white/55" aria-hidden="true" />
          <span>{restaurants.length} shown</span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-3 z-10" data-swipe-ignore="true">
        {restaurants.length > 0 ? (
          <RestaurantMapCarousel
            restaurants={restaurants}
            selectedRestaurantId={selectedRestaurantId}
            onSelect={setSelectedRestaurantId}
            setCardRef={setRestaurantCardRef}
          />
        ) : (
          <div className="px-4">
            <MapEmptyState hasActiveFilters={hasActiveFilters} locationStatus={locationStatus} onClearFilters={clearFilters} onUseLocation={requestUserLocation} />
          </div>
        )}
      </div>
    </div>
  );
}

function RestaurantMapCarousel({
  restaurants,
  selectedRestaurantId,
  onSelect,
  setCardRef,
}: {
  restaurants: RestaurantMapResult[];
  selectedRestaurantId: string | null;
  onSelect: (id: string) => void;
  setCardRef: (id: string) => (node: HTMLButtonElement | null) => void;
}) {
  return (
    <section className="overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Healthy restaurant results">
      <div className="flex snap-x snap-mandatory gap-3">
        {restaurants.map((restaurant) => {
          const isSelected = restaurant.id === selectedRestaurantId;
          return (
            <button
              key={restaurant.id}
              ref={setCardRef(restaurant.id)}
              type="button"
              className={`group min-h-[238px] w-[84%] max-w-[356px] shrink-0 snap-center overflow-hidden rounded-xl border bg-white text-left shadow-[0_16px_34px_rgba(0,31,33,0.2)] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/45 ${
                isSelected ? "border-[#111314]" : "border-white/90"
              }`}
              onClick={() => onSelect(restaurant.id)}
              aria-pressed={isSelected}
            >
              <span className="relative block h-[142px] overflow-hidden bg-[#DDE8E9]">
                <img className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={restaurant.imageSrc} alt="" />
                <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black uppercase leading-4 tracking-[0.1em] text-[#00696B] shadow-[0_6px_16px_rgba(0,31,33,0.14)]">
                  BetterBite
                </span>
                <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[#191C1D] shadow-[0_6px_16px_rgba(0,31,33,0.16)]">
                  <Heart size={19} strokeWidth={2.4} />
                </span>
              </span>
              <span className="block p-4">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[19px] font-black leading-6 text-[#191C1D]">{restaurant.chain}</span>
                    <span className="mt-1 block truncate text-[13px] font-bold leading-5 text-[#566164]">{restaurant.category}</span>
                  </span>
                  {isSelected && (
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111314] text-white">
                      <CheckCircle2 size={15} strokeWidth={2.6} />
                    </span>
                  )}
                </span>
                <span className="mt-3 flex items-center gap-2 text-[13px] font-bold leading-5 text-[#566164]">
                  <span className="inline-flex items-center gap-1 text-[#735A00]">
                    <Star size={15} fill="currentColor" strokeWidth={2.2} />
                    <span className="font-black text-[#2E484A]">{restaurant.rating}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{restaurant.eta}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDistance(restaurant.distanceMiles)}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MapEmptyState({
  hasActiveFilters,
  locationStatus,
  onClearFilters,
  onUseLocation,
}: {
  hasActiveFilters: boolean;
  locationStatus: LocationStatus;
  onClearFilters: () => void;
  onUseLocation: () => void;
}) {
  return (
    <section className="rounded-xl border border-white/80 bg-white/95 p-4 shadow-[0_14px_34px_rgba(0,72,75,0.18)] backdrop-blur" aria-label="No healthy restaurants found">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF4D6] text-[#765800]">
          <AlertTriangle size={20} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-black leading-6 text-[#191C1D]">No approved restaurants here yet</h2>
          <p className="mt-1 text-[13px] font-semibold leading-5 text-[#566164]">
            BetterBite only shows curated restaurants that pass seed-oil, artificial-color, and processing checks.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {hasActiveFilters && (
          <button
            type="button"
            className="min-h-10 flex-1 rounded-lg border border-[#DDE8E9] bg-white px-3 text-[13px] font-black text-[#3B4949] transition hover:bg-[#EEF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        )}
        {locationStatus !== "ready" && (
          <button
            type="button"
            className="min-h-10 flex-1 rounded-lg bg-[#00696B] px-3 text-[13px] font-black text-white transition hover:bg-[#005B5D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/45"
            onClick={onUseLocation}
          >
            Use location
          </button>
        )}
      </div>
    </section>
  );
}

function createRestaurantMarkerElement(restaurant: RestaurantMapResult, selected: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = selected ? "betterbite-map-marker betterbite-map-marker--selected" : "betterbite-map-marker";
  button.setAttribute("aria-label", `${restaurant.chain}, ${restaurant.city}, rating ${restaurant.rating}`);

  if (selected) {
    const pin = document.createElement("span");
    pin.className = "betterbite-map-marker__selected-pin";
    pin.setAttribute("aria-hidden", "true");
    pin.textContent = "✓";
    button.append(pin);

    const label = document.createElement("span");
    label.className = "betterbite-map-marker__selected-label";
    label.textContent = restaurant.chain;
    button.append(label);
    return button;
  }

  const rating = document.createElement("span");
  rating.className = "betterbite-map-marker__rating";
  rating.textContent = restaurant.rating;
  button.append(rating);

  const accent = document.createElement("span");
  accent.className = "betterbite-map-marker__accent";
  accent.setAttribute("aria-hidden", "true");
  button.append(accent);

  return button;
}

function createUserMarkerElement(): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "betterbite-map-user-marker";
  element.setAttribute("aria-label", "Your location");
  return element;
}

function getLocationCopy(locationStatus: LocationStatus, resultCount: number): string {
  if (locationStatus === "requesting") {
    return "Checking location";
  }

  if (locationStatus === "ready") {
    return resultCount === 1 ? "One nearby place" : "Nearby places";
  }

  if (locationStatus === "blocked") {
    return "Curated coverage";
  }

  return "Curated coverage";
}

function formatDistance(distance: number | null): string {
  if (distance === null) {
    return "Curated";
  }

  if (distance < 0.1) {
    return "Nearby";
  }

  return `${distance.toFixed(1)} mi`;
}

function toLngLat(point: GeoPoint): [number, number] {
  return [point.longitude, point.latitude];
}
