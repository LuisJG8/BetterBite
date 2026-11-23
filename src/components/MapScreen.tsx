import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "./restaurantMap.css";

import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Heart,
  Leaf,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  Star,
} from "lucide-react";
import { AttributionControl, LngLatBounds, Marker, Map as MapLibreMap, setWorkerUrl, type MapOptions } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getMapLocationFailureReason,
  mapLocationResolver,
  type AccurateMapLocation,
  type MapLocationFailureReason,
} from "../lib/mapLocation";
import {
  DEFAULT_MAP_STYLE_URL,
  getMapCameraPlan,
  getMapDetailMode,
  getMapDiscoveryMode,
  getSimplifiedLayerMinZoom,
  RESTAURANT_MARKER_POSITIONING,
  shouldHideFlatMapLayer,
  type MapCameraPlan,
  type MapDiscoveryMode,
  type MapLocationStatus,
} from "../lib/mapPresentation";
import {
  DEFAULT_NEARBY_RADIUS_MILES,
  RESTAURANT_DIET_FILTERS,
  RESTAURANT_PRICE_RANGES,
  RESTAURANT_RATING_RANGES,
  filterHealthyRestaurants,
  getNearestRestaurantId,
  getPreferredRestaurantId,
  type GeoPoint,
  type RestaurantDietFilter,
  type RestaurantMapResult,
  type RestaurantPriceRange,
  type RestaurantRatingRange,
} from "../lib/restaurantMap";
import { clearMapLocation, loadFavoriteRestaurantIds, loadMapLocation, saveFavoriteRestaurantIds, saveMapLocation } from "../lib/storage";

setWorkerUrl(mapWorkerUrl);

type RestaurantMarkerRecord = {
  element: HTMLButtonElement;
  marker: Marker;
};

type MapLocationGateFailure = MapLocationFailureReason | "unsupported";
type RestaurantFilterMenu = "price" | "food" | "rating";

const LOCAL_MAP_ZOOM = 14.7;
const MIN_LOCAL_MAP_ZOOM = 9;
const SELECTED_PLACE_FLIGHT_DURATION_MS = 1_250;
const SELECTED_PLACE_FLIGHT_CURVE = 1.3;
const CUSTOM_MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL?.trim();
const MAP_STYLE_URL = CUSTOM_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

export function MapScreen({ onScanMenu }: { onScanMenu?: (restaurantName: string) => void }) {
  const mapShellRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapStyleReadyRef = useRef(false);
  const restaurantMarkersRef = useRef<Map<string, RestaurantMarkerRecord>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);
  const filterControlsRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);
  const [query, setQuery] = useState("");
  const [selectedDietFilters, setSelectedDietFilters] = useState<RestaurantDietFilter[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<RestaurantPriceRange[]>([]);
  const [selectedRatingRanges, setSelectedRatingRanges] = useState<RestaurantRatingRange[]>([]);
  const [openFilterMenu, setOpenFilterMenu] = useState<RestaurantFilterMenu | null>(null);
  const [userLocation, setUserLocation] = useState<AccurateMapLocation | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const locationRequestRef = useRef(0);
  const userLocationRef = useRef<AccurateMapLocation | null>(userLocation);
  const [locationStatus, setLocationStatus] = useState<MapLocationStatus>("idle");
  const [locationFailure, setLocationFailure] = useState<MapLocationGateFailure | null>(null);
  const [locationRetryCount, setLocationRetryCount] = useState(0);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [focusedRestaurantId, setFocusedRestaurantId] = useState<string | null>(null);
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<Set<string>>(() => new Set(loadFavoriteRestaurantIds()));
  const [mapError, setMapError] = useState(false);
  const hasUserLocation = Boolean(userLocation);
  const discoveryMode = getMapDiscoveryMode(locationStatus, browseAll);
  const showsDiscoveryControls = discoveryMode === "nearby" || discoveryMode === "browse";
  const mapVisible = hasUserLocation || browseAll;

  const restaurants = useMemo(
    () => {
      if (!showsDiscoveryControls) {
        return [];
      }

      return filterHealthyRestaurants({
        selectedDietFilters,
        selectedPriceRanges,
        selectedRatingRanges,
        query,
        userLocation,
        maxDistanceMiles: DEFAULT_NEARBY_RADIUS_MILES,
      });
    },
    [showsDiscoveryControls, query, selectedDietFilters, selectedPriceRanges, selectedRatingRanges, userLocation],
  );
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null;
  const nearestRestaurantId = getNearestRestaurantId(restaurants, discoveryMode === "nearby");
  const hasActiveFilters =
    selectedDietFilters.length > 0 ||
    selectedPriceRanges.length > 0 ||
    selectedRatingRanges.length > 0 ||
    query.trim().length > 0;
  const showEmptyResults = showsDiscoveryControls && restaurants.length === 0;
  const mapCameraPlan = useMemo(
    () =>
      getMapCameraPlan({
        discoveryMode,
        resultLocations: restaurants.map((restaurant) => restaurant.coordinates),
        selectedLocation:
          selectedRestaurant && focusedRestaurantId === selectedRestaurant.id ? selectedRestaurant.coordinates : null,
        userAccuracyMeters: userLocation?.accuracyMeters ?? null,
        userLocation,
      }),
    [discoveryMode, focusedRestaurantId, restaurants, selectedRestaurant, userLocation],
  );

  const clearRestaurantMarkers = useCallback(() => {
    for (const { marker } of restaurantMarkersRef.current.values()) {
      marker.remove();
    }
    restaurantMarkersRef.current.clear();
  }, []);

  const forgetLocation = useCallback(() => {
    locationRequestRef.current += 1;
    userLocationRef.current = null;
    setUserLocation(null);
    clearMapLocation();
  }, []);

  const resolveUserLocation = useCallback(async () => {
    const requestId = ++locationRequestRef.current;
    setLocationFailure(null);
    setLocationStatus("requesting");

    if (!navigator.geolocation) {
      if (!isMountedRef.current || requestId !== locationRequestRef.current) {
        return;
      }

      setLocationFailure("unsupported");
      setLocationRetryCount((count) => count + 1);
      setLocationStatus(userLocationRef.current ? "ready" : "blocked");
      return;
    }

    try {
      const location = await mapLocationResolver.getCurrentLocation(navigator.geolocation);
      if (!isMountedRef.current || requestId !== locationRequestRef.current) {
        return;
      }

      userLocationRef.current = location;
      setUserLocation(location);
      saveMapLocation(location);
      setLocationFailure(null);
      setLocationStatus("ready");
    } catch (error) {
      if (!isMountedRef.current || requestId !== locationRequestRef.current) {
        return;
      }

      const reason = getMapLocationFailureReason(error);
      if (reason === "permission-denied") forgetLocation();
      setLocationFailure(reason);
      setLocationRetryCount((count) => count + 1);
      setLocationStatus(userLocationRef.current ? "ready" : "blocked");
    }
  }, [forgetLocation]);

  const requestUserLocation = useCallback(() => {
    void resolveUserLocation();
  }, [resolveUserLocation]);

  useEffect(() => {
    isMountedRef.current = true;
    let active = true;
    let permission: PermissionStatus | undefined;
    const syncPermission = () => {
      if (!active || !permission) return;
      if (permission.state === "granted") {
        const saved = loadMapLocation();
        if (saved && !userLocationRef.current) {
          userLocationRef.current = saved;
          setUserLocation(saved);
          setLocationStatus("ready");
        }
      } else if (permission.state === "denied" || userLocationRef.current) {
        forgetLocation();
        setLocationFailure(permission.state === "denied" ? "permission-denied" : null);
        setLocationStatus("blocked");
      } else {
        clearMapLocation();
      }
    };
    if (!navigator.permissions?.query) clearMapLocation();
    void navigator.permissions?.query({ name: "geolocation" }).then((status) => {
      if (!active) return;
      permission = status;
      syncPermission();
      permission.addEventListener("change", syncPermission);
    }).catch(() => {
      // Some WebViews support geolocation without exposing its permission state.
      if (active && !userLocationRef.current) clearMapLocation();
    });
    return () => {
      active = false;
      isMountedRef.current = false;
      locationRequestRef.current += 1;
      permission?.removeEventListener("change", syncPermission);
    };
  }, [forgetLocation]);

  useEffect(() => {
    if (!openFilterMenu) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!filterControlsRef.current?.contains(event.target as Node)) {
        setOpenFilterMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFilterMenu();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openFilterMenu]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !mapVisible) {
      return;
    }

    const options: MapOptions = {
      attributionControl: false,
      bearing: 0,
      center: userLocation ? toLngLat(userLocation) : [-98.58, 39.83],
      container: mapContainerRef.current,
      dragRotate: false,
      maxPitch: 0,
      maxZoom: 18,
      minPitch: 0,
      minZoom: userLocation ? MIN_LOCAL_MAP_ZOOM : 2,
      pitch: 0,
      pitchWithRotate: false,
      style: MAP_STYLE_URL,
      touchPitch: false,
      zoom: userLocation ? LOCAL_MAP_ZOOM : 3,
    };
    let map: MapLibreMap;
    try {
      map = new MapLibreMap(options);
    } catch {
      setMapError(true);
      return;
    }
    const syncMapDetailMode = () => {
      if (mapShellRef.current) {
        mapShellRef.current.dataset.mapDetail = getMapDetailMode(map.getZoom());
      }
    };
    const handleMapLoad = () => {
      applyFreshFlatMapStyle(map);
      mapStyleReadyRef.current = true;
      syncMapDetailMode();
      map.resize();
      setMapError(false);
    };
    const handleMapError = () => setMapError(true);
    const handleMapIdle = () => setMapError(false);

    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    const mapShell = mapShellRef.current;
    const attribution = map.getContainer().querySelector<HTMLElement>(".maplibregl-ctrl-bottom-left");
    const syncAttributionHeight = () => {
      if (mapShell && attribution) {
        mapShell.style.setProperty("--map-attribution-height", `${attribution.offsetHeight}px`);
      }
    };
    syncAttributionHeight();
    const attributionObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncAttributionHeight);
    if (attribution) attributionObserver?.observe(attribution);
    map.on("zoom", syncMapDetailMode);
    map.once("load", handleMapLoad);
    map.on("error", handleMapError);
    map.on("idle", handleMapIdle);
    mapRef.current = map;

    const resizeTimer = window.setTimeout(() => map.resize(), 100);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            map.resize();
          });
    resizeObserver?.observe(mapContainerRef.current);

    return () => {
      window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      attributionObserver?.disconnect();
      mapShell?.style.removeProperty("--map-attribution-height");
      clearRestaurantMarkers();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.off("zoom", syncMapDetailMode);
      map.off("load", handleMapLoad);
      map.off("error", handleMapError);
      map.off("idle", handleMapIdle);
      map.remove();
      mapStyleReadyRef.current = false;
      mapRef.current = null;
    };
  }, [clearRestaurantMarkers, mapVisible, hasUserLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const moveMap = () => applyMapCameraPlan(map, mapCameraPlan);

    if (mapStyleReadyRef.current) {
      moveMap();
      return;
    }

    map.once("load", moveMap);
    return () => {
      map.off("load", moveMap);
    };
  }, [mapCameraPlan]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const visibleRestaurantIds = new Set(restaurants.map((restaurant) => restaurant.id));
    for (const [restaurantId, record] of restaurantMarkersRef.current) {
      if (!visibleRestaurantIds.has(restaurantId)) {
        record.marker.remove();
        restaurantMarkersRef.current.delete(restaurantId);
      }
    }

    for (const restaurant of restaurants) {
      let record = restaurantMarkersRef.current.get(restaurant.id);
      if (!record) {
        const element = createRestaurantMarkerElement(restaurant);
        element.addEventListener("click", () => {
          setSelectedRestaurantId(restaurant.id);
          setFocusedRestaurantId(restaurant.id);
        });
        const marker = new Marker({ ...RESTAURANT_MARKER_POSITIONING, element })
          .setLngLat(toLngLat(restaurant.coordinates))
          .addTo(map);
        record = { element, marker };
        restaurantMarkersRef.current.set(restaurant.id, record);
      } else {
        record.marker.setLngLat(toLngLat(restaurant.coordinates));
      }

      updateRestaurantMarkerElement(
        record.element,
        restaurant,
        restaurant.id === selectedRestaurantId,
        restaurant.id === nearestRestaurantId,
      );
    }
  }, [nearestRestaurantId, restaurants, selectedRestaurantId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(toLngLat(userLocation));
      updateUserMarkerElement(userMarkerRef.current.getElement(), userLocation.accuracyMeters);
      return;
    }

    userMarkerRef.current = new Marker({ anchor: "center", element: createUserMarkerElement(userLocation.accuracyMeters) })
      .setLngLat(toLngLat(userLocation))
      .addTo(map);
  }, [userLocation]);

  useEffect(() => {
    setSelectedRestaurantId((currentId) => getPreferredRestaurantId(restaurants, currentId));
    setFocusedRestaurantId((currentId) =>
      currentId && restaurants.some((restaurant) => restaurant.id === currentId) ? currentId : null,
    );
  }, [restaurants]);

  function toggleDietFilter(filter: RestaurantDietFilter) {
    setSelectedDietFilters((currentFilters) => toggleSelectedValue(currentFilters, filter));
  }

  function togglePriceRange(range: RestaurantPriceRange) {
    setSelectedPriceRanges((currentRanges) => toggleSelectedValue(currentRanges, range));
  }

  function toggleRatingRange(range: RestaurantRatingRange) {
    setSelectedRatingRanges((currentRanges) => toggleSelectedValue(currentRanges, range));
  }

  function closeFilterMenu() {
    filterControlsRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
    setOpenFilterMenu(null);
  }

  function clearFilters() {
    setQuery("");
    setSelectedDietFilters([]);
    setSelectedPriceRanges([]);
    setSelectedRatingRanges([]);
    setOpenFilterMenu(null);
  }

  return (
    <div
      ref={mapShellRef}
      className="betterbite-map-shell relative h-full min-h-full overflow-hidden bg-[#EAF4F1]"
      data-discovery-mode={discoveryMode}
      data-map-detail="overview"
      data-swipe-ignore="true"
    >
      <div ref={mapContainerRef} className="betterbite-map-canvas absolute inset-0" aria-label="BetterBite verified restaurant map" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#F8FBFA]/95 via-[#F8FBFA]/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#F8FBFA]/80 to-transparent" />

      {showsDiscoveryControls && (
        <div className="map-search-tools" data-swipe-ignore="true">
          <div className="relative min-w-0">
            <label className="sr-only" htmlFor="restaurant-map-search">Search verified restaurants</label>
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#315354]" size={18} strokeWidth={2.6} />
            <input
              id="restaurant-map-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="map-search-field"
              placeholder={userLocation ? "Search places near you" : "Search verified places"}
              type="search"
            />
            <button
              type="button"
              className="map-search-location"
              onClick={requestUserLocation}
              disabled={locationStatus === "requesting"}
              aria-label="Share device location"
            >
              {locationStatus === "requesting" ? <Loader2 className="animate-spin" size={19} /> : <LocateFixed size={19} strokeWidth={2.7} />}
            </button>
          </div>

          <div ref={filterControlsRef} className="relative" aria-label="Restaurant map filters">
            <div className="flex items-center justify-start gap-2">
              <MapFilterChip
                count={selectedPriceRanges.length}
                expanded={openFilterMenu === "price"}
                icon={<DollarSign size={12} strokeWidth={2.5} aria-hidden="true" />}
                label="Price"
                menuId="restaurant-price-filter-menu"
                onClick={() => setOpenFilterMenu((current) => (current === "price" ? null : "price"))}
              />
              <MapFilterChip
                count={selectedDietFilters.length}
                expanded={openFilterMenu === "food"}
                icon={<Leaf size={12} strokeWidth={2.5} aria-hidden="true" />}
                label="Food"
                menuId="restaurant-food-filter-menu"
                onClick={() => setOpenFilterMenu((current) => (current === "food" ? null : "food"))}
              />
              <MapFilterChip
                count={selectedRatingRanges.length}
                expanded={openFilterMenu === "rating"}
                icon={<Star size={12} strokeWidth={2.5} aria-hidden="true" />}
                label="Rating"
                menuId="restaurant-rating-filter-menu"
                onClick={() => setOpenFilterMenu((current) => (current === "rating" ? null : "rating"))}
              />
            </div>

            {openFilterMenu === "price" && (
              <MapFilterDropdown
                description="Choose one or more ranges, up to $100."
                id="restaurant-price-filter-menu"
                onClear={() => setSelectedPriceRanges([])}
                onDone={closeFilterMenu}
                onToggle={togglePriceRange}
                options={RESTAURANT_PRICE_RANGES}
                selectedValues={selectedPriceRanges}
                title="Price per person"
              />
            )}
            {openFilterMenu === "food" && (
              <MapFilterDropdown
                description="A place must offer every option you select."
                id="restaurant-food-filter-menu"
                onClear={() => setSelectedDietFilters([])}
                onDone={closeFilterMenu}
                onToggle={toggleDietFilter}
                options={RESTAURANT_DIET_FILTERS}
                selectedValues={selectedDietFilters}
                title="Food options"
              />
            )}
            {openFilterMenu === "rating" && (
              <MapFilterDropdown
                description="Choose one or more Google rating bands."
                id="restaurant-rating-filter-menu"
                onClear={() => setSelectedRatingRanges([])}
                onDone={closeFilterMenu}
                onToggle={toggleRatingRange}
                options={RESTAURANT_RATING_RANGES}
                selectedValues={selectedRatingRanges}
                title="Restaurant quality"
              />
            )}
          </div>

          {mapError && (
            <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-[#FFF3D6]/95 px-3.5 py-2 text-[12px] font-semibold text-[#70561A] shadow-[0_8px_20px_rgba(0,64,66,0.1)]" role="status">
              <AlertTriangle size={15} aria-hidden="true" />
              The map is unavailable. You can still browse restaurant details.
            </div>
          )}
        </div>
      )}

      {(discoveryMode === "locating" || discoveryMode === "location-required") && (
        <MapLocationGate
          onBrowse={() => setBrowseAll(true)}
          onRequestLocation={requestUserLocation}
          failure={locationFailure}
          locating={discoveryMode === "locating"}
          retryCount={locationRetryCount}
        />
      )}

      {(selectedRestaurant || showEmptyResults) && (
        <div className="map-result-panel" data-swipe-ignore="true">
          {restaurants.length > 1 && (
            <label className="map-result-picker">
              <span className="sr-only">Choose a verified restaurant</span>
              <select value={selectedRestaurant?.id ?? ""} onChange={(event) => {
                setSelectedRestaurantId(event.target.value);
                setFocusedRestaurantId(event.target.value);
              }}>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
              </select>
            </label>
          )}
          {selectedRestaurant ? (
            <RestaurantMapCard
              expanded={focusedRestaurantId === selectedRestaurant.id}
              isFavorite={favoriteRestaurantIds.has(selectedRestaurant.id)}
              restaurant={selectedRestaurant}
              onScanMenu={onScanMenu}
              onExpand={() => setFocusedRestaurantId(selectedRestaurant.id)}
              onFavoriteToggle={() => {
                const next = new Set(favoriteRestaurantIds);
                if (next.has(selectedRestaurant.id)) next.delete(selectedRestaurant.id);
                else next.add(selectedRestaurant.id);
                setFavoriteRestaurantIds(next);
                saveFavoriteRestaurantIds([...next]);
              }}
            />
          ) : (
            <MapEmptyState hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
          )}
        </div>
      )}
    </div>
  );
}

function MapFilterChip({
  count,
  expanded,
  icon,
  label,
  menuId,
  onClick,
}: {
  count: number;
  expanded: boolean;
  icon: ReactNode;
  label: string;
  menuId: string;
  onClick: () => void;
}) {
  const hasSelection = count > 0;

  return (
    <button
      type="button"
      className="map-filter-chip"
      data-has-selection={hasSelection}
      aria-controls={menuId}
      aria-expanded={expanded}
      aria-label={`${label} filter${count > 0 ? `, ${count} selected` : ""}`}
      onClick={onClick}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {hasSelection && (
        <span className="map-filter-count">
          {count}
        </span>
      )}
      <ChevronDown
        className={`shrink-0 transition-transform duration-200 ${expanded ? "" : "rotate-180"}`}
        size={10}
        strokeWidth={2.8}
        aria-hidden="true"
      />
    </button>
  );
}

function MapFilterDropdown<T extends string>({
  description,
  id,
  onClear,
  onDone,
  onToggle,
  options,
  selectedValues,
  title,
}: {
  description: string;
  id: string;
  onClear: () => void;
  onDone: () => void;
  onToggle: (value: T) => void;
  options: Array<{ id: T; label: string }>;
  selectedValues: T[];
  title: string;
}) {
  return (
    <section
      id={id}
      className="map-filter-menu"
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#E3ECEA] px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="map-filter-title">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>
        {selectedValues.length > 0 && (
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-leaf transition hover:bg-[#EAF6F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8AB]/35"
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3" role="group" aria-label={`${title} choices`}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8AB]/35 ${
                isSelected
                  ? "border-[#70C6B5] bg-oat text-[#174D43]"
                  : "border-[#E1EAE8] bg-[#F9FBFA] text-[#3A5658] hover:border-[#B9D6D0] hover:bg-white"
              }`}
              aria-pressed={isSelected}
              onClick={() => onToggle(option.id)}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  isSelected ? "border-[#00696B] bg-leaf text-white" : "border-[#B8CBC7] bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check size={13} strokeWidth={3} />
              </span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-[#E3ECEA] bg-[#FAFCFB] p-3">
        <button
          type="button"
          className="min-h-11 w-full rounded-xl bg-leaf px-4 text-[13px] font-semibold text-white transition hover:bg-[#005A5C] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8AB]/45"
          onClick={onDone}
        >
          Done{selectedValues.length > 0 ? ` · ${selectedValues.length} selected` : ""}
        </button>
      </div>
    </section>
  );
}

function toggleSelectedValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((currentValue) => currentValue !== value) : [...values, value];
}

function MapLocationGate({
  onBrowse,
  onRequestLocation,
  failure,
  locating,
  retryCount,
}: {
  onBrowse: () => void;
  onRequestLocation: () => void;
  failure: MapLocationGateFailure | null;
  locating: boolean;
  retryCount: number;
}) {
  const failureCopy = getLocationFailureCopy(failure, retryCount);

  return (
    <section
      className="map-location-gate"
      aria-label={locating ? "Finding your location" : "Location needed for nearby places"}
    >
      <div className="map-location-card">
        <div className="map-location-row">
          <span className="map-location-symbol" aria-hidden="true">
            {locating ? <Loader2 className="animate-spin" size={24} /> : <LocateFixed size={24} />}
          </span>
          <button
            type="button"
            className="map-location-action"
            onClick={onRequestLocation}
            disabled={locating}
            aria-label="Share device location"
          >
            {locating ? <Loader2 className="animate-spin" size={18} /> : <LocateFixed size={18} />}
            Share device location
          </button>
        </div>
        <div aria-live="polite" role="status">
          <h2 className="map-location-heading">{locating ? "Checking your location" : failureCopy.heading}</h2>
          <p className="map-location-copy">
            {locating ? "Checking location access and getting an accurate neighborhood position." : failureCopy.description}
          </p>
          {!locating && retryCount > 0 && (
            <p className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-[#FFF3D6] px-3 py-1.5 text-[12px] font-semibold text-[#70561A]">
              <AlertTriangle size={14} aria-hidden="true" />
              Location checked again
            </p>
          )}
        </div>
        {!locating && <button type="button" className="map-browse-action" onClick={onBrowse}>Browse without location</button>}
      </div>
    </section>
  );
}

function getLocationFailureCopy(failure: MapLocationGateFailure | null, retryCount: number) {
  switch (failure) {
    case "permission-denied":
      return {
        heading: "Location access is blocked",
        description:
          retryCount > 0
            ? "Location is still blocked. Allow access in your browser or device settings, then tap the location icon again."
            : "Allow location access in your browser or device settings, then tap the location icon again.",
      };
    case "timeout":
      return {
        heading: "Location check timed out",
        description: "Make sure Location Services are on, then tap the location icon again.",
      };
    case "invalid-response":
      return {
        heading: "Location needs another check",
        description: "The device returned an invalid position. Tap the location icon to try again.",
      };
    case "unsupported":
      return {
        heading: "Location is unavailable here",
        description: "BetterBite needs device location to show nearby restaurants. Try a browser or device with Location Services.",
      };
    case "position-unavailable":
      return {
        heading: "We couldn't find your location",
        description: "Make sure Location Services are on and that this app can use them, then tap the location icon again.",
      };
    default:
      return {
        heading: "Show your nearby map",
        description: "Tap the location icon in the upper right to share this device's location and find nearby verified places.",
      };
  }
}

function RestaurantMapCard({
  expanded,
  isFavorite,
  restaurant,
  onExpand,
  onFavoriteToggle,
  onScanMenu,
}: {
  expanded: boolean;
  isFavorite: boolean;
  restaurant: RestaurantMapResult;
  onExpand: () => void;
  onFavoriteToggle: () => void;
  onScanMenu?: (restaurantName: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openedFromCard = useRef(false);
  useEffect(() => {
    if (expanded && openedFromCard.current) {
      headingRef.current?.focus({ preventScroll: true });
      openedFromCard.current = false;
    }
  }, [expanded]);
  const googleDirectionsUrl = getGoogleDirectionsUrl(restaurant);
  const photoSources = restaurant.publicDetails?.photoSources ?? [restaurant.logoSrc];

  if (!expanded) {
    return (
      <section className="map-restaurant" aria-label="Restaurant details">
        <article className="map-card map-card-compact">
          <div className="flex min-h-11 items-center border-b border-[#E4ECEA] bg-white px-4">
            <h2 className="map-card-heading">{restaurant.distanceMiles === null ? "Pickup spots" : "Pickup spots near you"}</h2>
          </div>

          <button
            type="button"
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00A8AB]/55"
            onClick={() => {
              openedFromCard.current = true;
              onExpand();
            }}
            aria-label={`View details for ${restaurant.name}`}
          >
            <span className="map-card-photo">
              <img
                className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                src={photoSources[0]}
                alt={`${restaurant.chain} ${restaurant.city} location`}
              />
            </span>

            <span className="relative block min-h-[68px] border-t border-[#E4ECEA] bg-white px-4 py-2.5 pr-16">
              <span className="block truncate text-[18px] font-bold leading-6 text-[#1E2B2C]">{restaurant.chain}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold leading-4 text-[#647476]">
                <MapPin className="text-[#B78A18]" size={13} strokeWidth={2.6} aria-hidden="true" />
                {restaurant.distanceMiles !== null ? formatDistance(restaurant.distanceMiles) : restaurant.city}
              </span>
              <span className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center overflow-hidden rounded-xl bg-[#FFF9E9] p-1.5">
                <img className="h-full w-full object-contain" src={restaurant.logoSrc} alt="" />
              </span>
            </span>
          </button>

          <button
            type="button"
            className="map-card-favorite"
            onClick={onFavoriteToggle}
            aria-label={isFavorite ? `Remove ${restaurant.chain} from favorites` : `Add ${restaurant.chain} to favorites`}
            aria-pressed={isFavorite}
          >
            <Heart
              className={isFavorite ? "fill-current" : "fill-none"}
              size={25}
              strokeWidth={2.7}
              aria-hidden="true"
            />
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="map-restaurant" aria-label="Selected restaurant details">
      <article className="map-card map-card-expanded">
        <div className="relative flex min-h-11 shrink-0 items-center border-b border-[#E2ECE9] px-4">
          <h2 className="map-card-heading">{restaurant.distanceMiles === null ? "Pickup spots" : "Pickup spots near you"}</h2>
        </div>

        <div className="map-card-photos">
          {photoSources.slice(0, 2).map((photoSource, index) => (
            <img
              key={photoSource}
              className="h-full w-full object-cover"
              src={photoSource}
              alt={index === 0 ? `${restaurant.chain} ${restaurant.city} location` : `${restaurant.chain} featured dish`}
            />
          ))}
        </div>

        <div
          className="map-card-body"
          tabIndex={0}
          role="region"
          aria-label={restaurant.name}
          data-restaurant-details-scroll="true"
        >
          <div className="flex items-start gap-3">
            <RestaurantLogo restaurant={restaurant} />
            <div className="min-w-0 flex-1">
              <h3 ref={headingRef} tabIndex={-1} className="map-card-name">{restaurant.name}</h3>
              <p className="mt-0.5 text-[12px] font-bold leading-4 text-[#667779]">{restaurant.category}</p>
              {restaurant.publicDetails && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] font-semibold text-[#314F50]">
                  <span>{restaurant.publicDetails.googleRating.toFixed(1)}</span>
                  <Star className="fill-[#F5B841] text-[#F5B841]" size={15} strokeWidth={2.2} aria-hidden="true" />
                  <span className="font-bold text-[#708183]">
                    {restaurant.publicDetails.googleReviewCount.toLocaleString()} Google reviews
                  </span>
                  <span className="font-bold text-[#708183]">· {formatPricePerPerson(restaurant.publicDetails.pricePerPersonEstimate)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 text-[12px] font-bold leading-5 text-[#526769]">
            <MapPin className="mt-0.5 shrink-0 text-[#E48B3A]" size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>
              {restaurant.address}, {restaurant.city}, {restaurant.state}
              {restaurant.distanceMiles !== null ? ` · ${formatDistance(restaurant.distanceMiles)}` : ""}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Dietary categories">
            <RestaurantDietTags restaurant={restaurant} />
          </div>

          <div className="mt-3 rounded-2xl bg-cream p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#607476]">Popular here</p>
            <p className="mt-1 text-[12px] font-bold leading-5 text-[#294A4B]">{restaurant.menuHighlights.join(" · ")}</p>
          </div>

        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#E2ECE9] bg-white p-3">
          {onScanMenu && (
            <button type="button" className="map-scan-menu" onClick={() => onScanMenu(restaurant.name)} aria-label={`Scan ${restaurant.name} menu`}>
              <Camera size={16} aria-hidden="true" /> Scan menu
            </button>
          )}
          <a
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-leaf px-3 text-[12px] font-semibold text-white transition hover:bg-[#005A5C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8AB]/45"
            href={googleDirectionsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={15} strokeWidth={2.6} aria-hidden="true" />
            Directions
          </a>
          <a
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#D8E6E3] bg-white px-3 text-[12px] font-semibold text-[#315354] transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8AB]/35"
            href={restaurant.publicDetails?.googleReviewsUrl ?? restaurant.verification.locationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Google reviews
            <ExternalLink size={14} strokeWidth={2.4} aria-hidden="true" />
          </a>
        </div>
      </article>
    </section>
  );
}

function RestaurantLogo({ restaurant }: { restaurant: RestaurantMapResult }) {
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E3EBE8] bg-[#FFF9E9] p-1.5 shadow-[0_6px_16px_rgba(0,64,66,0.09)]">
      <img className="h-full w-full rounded-xl object-contain" src={restaurant.logoSrc} alt={`${restaurant.chain} logo`} />
    </span>
  );
}

function RestaurantDietTags({ restaurant }: { restaurant: RestaurantMapResult }) {
  return restaurant.dietTags.slice(0, 3).map((tag) => (
    <span key={tag} className="rounded-full bg-[#E5F6EA] px-2.5 py-1 text-[11px] font-bold text-[#245F42]">
      {RESTAURANT_DIET_FILTERS.find((filter) => filter.id === tag)?.label ?? tag}
    </span>
  ));
}

function getGoogleDirectionsUrl(restaurant: RestaurantMapResult): string {
  const destination = encodeURIComponent(`${restaurant.address}, ${restaurant.city}, ${restaurant.state}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

function MapEmptyState({
  hasActiveFilters,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <section className="map-card p-4" aria-label="No verified restaurants found">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF3CC] text-[#745B14]">
          <AlertTriangle size={20} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="map-card-name">
            {hasActiveFilters ? "No places match these filters" : `No verified place within ${DEFAULT_NEARBY_RADIUS_MILES} miles`}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            {hasActiveFilters
              ? "Try another price, food option, or rating range, or clear the search."
              : "Your map is centered on your location. BetterBite only shows nearby restaurants with reviewable ingredient and menu standards."}
          </p>
        </div>
      </div>
      {hasActiveFilters && (
        <button
          type="button"
          className="mt-3 min-h-11 w-full rounded-xl border border-[#DDE8E5] bg-white px-3 text-[13px] font-semibold text-[#315354] transition hover:bg-[#EEF7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8AB]/35"
          onClick={onClearFilters}
        >
          Clear filters
        </button>
      )}
    </section>
  );
}

function formatPricePerPerson(estimate: number): string {
  return `~$${Math.round(estimate)}/person`;
}

function createRestaurantMarkerElement(restaurant: RestaurantMapResult): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.restaurantId = restaurant.id;

  const logoFrame = document.createElement("span");
  logoFrame.className = "betterbite-map-marker__logo-frame";

  const logo = document.createElement("img");
  logo.className = "betterbite-map-marker__logo";
  logo.src = restaurant.logoSrc;
  logo.alt = "";
  logo.setAttribute("aria-hidden", "true");
  logoFrame.append(logo);
  button.append(logoFrame);
  updateRestaurantMarkerElement(button, restaurant, false, false);
  return button;
}

function updateRestaurantMarkerElement(
  button: HTMLButtonElement,
  restaurant: RestaurantMapResult,
  selected: boolean,
  nearest: boolean,
) {
  const proximity = restaurant.distanceMiles === null ? "" : `, ${formatDistance(restaurant.distanceMiles)}`;
  const nearestLabel = nearest ? ", nearest verified location" : "";
  button.classList.add("betterbite-map-marker");
  button.classList.toggle("betterbite-map-marker--selected", selected);
  button.setAttribute("aria-pressed", String(selected));
  button.classList.toggle("betterbite-map-marker--nearest", nearest);
  button.setAttribute(
    "aria-label",
    `${restaurant.chain} in ${restaurant.city}, source-verified seed-oil-free restaurant${nearestLabel}${proximity}`,
  );

  let label = button.querySelector<HTMLSpanElement>("[data-marker-label]");
  const labelText = selected ? `${restaurant.chain} · ${restaurant.city}` : nearest ? "Nearest verified" : null;
  if (!labelText) {
    label?.remove();
    return;
  }

  if (!label) {
    label = document.createElement("span");
    label.dataset.markerLabel = "true";
    button.append(label);
  }

  label.className = selected
    ? "betterbite-map-marker__selected-label"
    : "betterbite-map-marker__selected-label betterbite-map-marker__nearest-label";
  label.textContent = labelText;
}

function createUserMarkerElement(accuracyMeters: number): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "betterbite-map-user-marker";
  updateUserMarkerElement(element, accuracyMeters);
  return element;
}

function updateUserMarkerElement(element: HTMLElement, accuracyMeters: number) {
  element.setAttribute("aria-label", `Your location, accurate to about ${formatLocationAccuracy(accuracyMeters)}`);
}

function applyMapCameraPlan(map: MapLibreMap, plan: MapCameraPlan) {
  if (plan.kind === "hold") {
    return;
  }

  if (plan.kind === "center") {
    if (plan.transition === "flight") {
      const verticalOffset = -Math.min(160, Math.round(map.getContainer().clientHeight * 0.17));
      map.flyTo({
        center: toLngLat(plan.center),
        curve: SELECTED_PLACE_FLIGHT_CURVE,
        duration: SELECTED_PLACE_FLIGHT_DURATION_MS,
        easing: smoothMapFlightEasing,
        essential: false,
        offset: [0, verticalOffset],
        zoom: plan.zoom,
      });
      return;
    }

    map.easeTo({ center: toLngLat(plan.center), duration: 650, essential: false, zoom: plan.zoom });
    return;
  }

  const bounds = new LngLatBounds();
  for (const point of plan.points) {
    bounds.extend(toLngLat(point));
  }
  map.fitBounds(bounds, {
    duration: 650,
    essential: false,
    maxZoom: plan.maxZoom,
    padding: Math.min(80, Math.round(Math.min(map.getContainer().clientHeight, map.getContainer().clientWidth) * 0.15)),
  });
}

function smoothMapFlightEasing(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function applyFreshFlatMapStyle(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (shouldHideFlatMapLayer(layer)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
      continue;
    }

    const normalizedLayerId = layer.id.toLowerCase().replaceAll("-", "_");
    if (layer.type === "line" && normalizedLayerId.includes("highway_minor")) {
      map.setPaintProperty(
        layer.id,
        "line-color",
        normalizedLayerId.includes("casing") ? "#D4DADB" : "#FFFFFF",
      );
      map.setPaintProperty(layer.id, "line-opacity", 0.9);
    }

    if (
      layer.type === "line" &&
      /(?:highway|bridge|tunnel)_(?:motorway|trunk|primary|secondary|tertiary|link)/.test(normalizedLayerId)
    ) {
      const isCasing = normalizedLayerId.includes("casing");
      const isMotorway = normalizedLayerId.includes("motorway");
      map.setPaintProperty(
        layer.id,
        "line-color",
        isCasing ? (isMotorway ? "#8E999B" : "#B8C0C0") : isMotorway ? "#CDD4D4" : "#F5F6F3",
      );
      map.setPaintProperty(layer.id, "line-opacity", 0.94);
    }

    if (layer.type === "fill" && normalizedLayerId === "landuse_residential") {
      map.setPaintProperty(layer.id, "fill-color", "#F5F5F1");
    }

    if (
      layer.type === "fill" &&
      (normalizedLayerId === "park" ||
        normalizedLayerId === "landcover_grass" ||
        normalizedLayerId === "landcover_grass_park")
    ) {
      map.setPaintProperty(layer.id, "fill-color", "#B7E58B");
      map.setPaintProperty(layer.id, "fill-opacity", normalizedLayerId === "park" ? 0.82 : 0.9);
    }

    if (layer.type === "symbol" && normalizedLayerId.includes("highway_name")) {
      map.setPaintProperty(layer.id, "text-color", "#626D70");
      map.setPaintProperty(layer.id, "text-halo-color", "rgba(255,255,255,0.92)");
    }

    const currentMinZoom = layer.minzoom ?? 0;
    const nextMinZoom = getSimplifiedLayerMinZoom(layer.id, currentMinZoom);
    if (nextMinZoom !== currentMinZoom) {
      map.setLayerZoomRange(layer.id, nextMinZoom, layer.maxzoom ?? 24);
    }
  }

  const colorUpdates = [
    ["background", "background-color", "#F7F7F3"],
    ["park", "fill-color", "#B9E58E"],
    ["water", "fill-color", "#75CEE8"],
    ["landuse_residential", "fill-color", "#F4F4F0"],
    ["highway_major_casing", "line-color", "#AAB4B5"],
    ["highway_major_inner", "line-color", "#E6EAEA"],
    ["highway_minor", "line-color", "#FFFFFF"],
    ["label_city", "text-color", "#4B565A"],
    ["label_city_capital", "text-color", "#4B565A"],
    ["label_state", "text-color", "#667277"],
  ] as const;

  for (const [layerId, property, color] of colorUpdates) {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, property, color);
    }
  }
}

function formatLocationAccuracy(accuracyMeters: number): string {
  const accuracyFeet = accuracyMeters * 3.28084;
  if (accuracyFeet < 1_000) {
    return `${Math.max(10, Math.round(accuracyFeet / 10) * 10)} ft`;
  }

  return `${(accuracyMeters / 1_609.344).toFixed(1)} mi`;
}

function formatDistance(distance: number | null): string {
  if (distance === null) {
    return "Turn on location for distance";
  }

  if (distance < 0.1) {
    return "Less than 0.1 mi";
  }

  return `${distance.toFixed(1)} mi away`;
}

function toLngLat(point: GeoPoint): [number, number] {
  return [point.longitude, point.latitude];
}
