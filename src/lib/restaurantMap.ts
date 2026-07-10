export type RestaurantDietFilter = "gluten-free" | "vegan" | "vegetarian";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RestaurantHealthCriteria {
  avoidsSeedOils: boolean;
  noArtificialColors: boolean;
  minimallyProcessedMenu: boolean;
}

export interface HealthyRestaurantPlace {
  id: string;
  name: string;
  chain: string;
  category: string;
  address: string;
  city: string;
  state: string;
  rating: string;
  eta: string;
  imageSrc: string;
  coordinates: GeoPoint;
  dietTags: RestaurantDietFilter[];
  healthCriteria: RestaurantHealthCriteria;
  menuHighlights: string[];
  verificationNote: string;
}

export interface RestaurantMapResult extends HealthyRestaurantPlace {
  distanceMiles: number | null;
}

export interface FilterHealthyRestaurantsOptions {
  restaurants?: HealthyRestaurantPlace[];
  selectedDietFilters?: RestaurantDietFilter[];
  query?: string;
  userLocation?: GeoPoint | null;
  maxDistanceMiles?: number;
}

export const RESTAURANT_DIET_FILTERS: Array<{ id: RestaurantDietFilter; label: string }> = [
  { id: "gluten-free", label: "Gluten free" },
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
];

export const DEFAULT_MAP_CENTER: GeoPoint = {
  latitude: 39.8283,
  longitude: -98.5795,
};

export const DEFAULT_NEARBY_RADIUS_MILES = 75;

export const HEALTHY_RESTAURANT_PLACES: HealthyRestaurantPlace[] = [
  {
    id: "true-food-kitchen-austin",
    name: "True Food Kitchen - Austin",
    chain: "True Food Kitchen",
    category: "Seasonal bowls",
    address: "222 West Ave",
    city: "Austin",
    state: "TX",
    rating: "4.8",
    eta: "20-30 min",
    imageSrc: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=700&q=80",
    coordinates: { latitude: 30.2679, longitude: -97.7511 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["Ancient grains", "Seasonal vegetables", "Olive-oil-forward dressings"],
    verificationNote: "BetterBite curated pilot record. Reconfirm location-level prep standards before expanding coverage.",
  },
  {
    id: "true-food-kitchen-santa-monica",
    name: "True Food Kitchen - Santa Monica",
    chain: "True Food Kitchen",
    category: "Clean plates",
    address: "395 Santa Monica Pl",
    city: "Santa Monica",
    state: "CA",
    rating: "4.8",
    eta: "20-30 min",
    imageSrc: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80",
    coordinates: { latitude: 34.0145, longitude: -118.4938 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["Grass-fed burger option", "Vegetable-forward entrees", "Gluten-free swaps"],
    verificationNote: "BetterBite curated pilot record. Reconfirm location-level prep standards before expanding coverage.",
  },
  {
    id: "true-food-kitchen-bethesda",
    name: "True Food Kitchen - Bethesda",
    chain: "True Food Kitchen",
    category: "Vegetable-forward meals",
    address: "7100 Wisconsin Ave",
    city: "Bethesda",
    state: "MD",
    rating: "4.7",
    eta: "25-35 min",
    imageSrc: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80",
    coordinates: { latitude: 38.9805, longitude: -77.0954 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["Seasonal bowls", "Cleaner burger path", "Vegetarian entrees"],
    verificationNote: "BetterBite curated pilot record. Reconfirm location-level prep standards before expanding coverage.",
  },
  {
    id: "true-food-kitchen-miami",
    name: "True Food Kitchen - Miami",
    chain: "True Food Kitchen",
    category: "Whole-food plates",
    address: "8888 SW 136th St",
    city: "Miami",
    state: "FL",
    rating: "4.9",
    eta: "20-30 min",
    imageSrc: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=700&q=80",
    coordinates: { latitude: 25.6918, longitude: -80.3407 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["Organic greens", "Plant-forward bowls", "Lower-sugar drinks"],
    verificationNote: "BetterBite curated pilot record. Reconfirm location-level prep standards before expanding coverage.",
  },
  {
    id: "olive-bowl-chicago",
    name: "Olive Bowl Kitchen - Chicago",
    chain: "Olive Bowl Kitchen",
    category: "Mediterranean bowls",
    address: "Pilot location",
    city: "Chicago",
    state: "IL",
    rating: "4.7",
    eta: "15-25 min",
    imageSrc: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=700&q=80",
    coordinates: { latitude: 41.8842, longitude: -87.6324 },
    dietTags: ["gluten-free", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["Olive oil dressings", "Grilled proteins", "Roasted potatoes"],
    verificationNote: "BetterBite pilot partner record used to exercise diet filters before live provider rollout.",
  },
  {
    id: "pasture-press-dallas",
    name: "Pasture & Press - Dallas",
    chain: "Pasture & Press",
    category: "Cleaner burger counter",
    address: "Pilot location",
    city: "Dallas",
    state: "TX",
    rating: "4.8",
    eta: "20-30 min",
    imageSrc: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80",
    coordinates: { latitude: 32.7851, longitude: -96.7995 },
    dietTags: ["gluten-free"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["Grass-fed burger", "Avocado-oil potato chips", "No artificial colors"],
    verificationNote: "BetterBite pilot partner record used to preserve burger cravings without broad healthy-food substitution.",
  },
];

export function filterHealthyRestaurants({
  restaurants = HEALTHY_RESTAURANT_PLACES,
  selectedDietFilters = [],
  query = "",
  userLocation = null,
  maxDistanceMiles = DEFAULT_NEARBY_RADIUS_MILES,
}: FilterHealthyRestaurantsOptions = {}): RestaurantMapResult[] {
  const normalizedQuery = normalizeSearchText(query);

  return restaurants
    .filter(isBetterBiteApprovedRestaurant)
    .filter((restaurant) => matchesDietFilters(restaurant, selectedDietFilters))
    .filter((restaurant) => matchesRestaurantQuery(restaurant, normalizedQuery))
    .map((restaurant) => ({
      ...restaurant,
      distanceMiles: userLocation ? distanceMiles(userLocation, restaurant.coordinates) : null,
    }))
    .filter((restaurant) => restaurant.distanceMiles === null || restaurant.distanceMiles <= maxDistanceMiles)
    .sort(compareRestaurantResults);
}

export function isBetterBiteApprovedRestaurant(restaurant: HealthyRestaurantPlace): boolean {
  return (
    restaurant.healthCriteria.avoidsSeedOils &&
    restaurant.healthCriteria.noArtificialColors &&
    restaurant.healthCriteria.minimallyProcessedMenu
  );
}

export function getMapCenterForLocationState(userLocation: GeoPoint | null, restaurants: RestaurantMapResult[]): GeoPoint {
  if (userLocation) {
    return userLocation;
  }

  if (restaurants.length > 0) {
    return restaurants[0].coordinates;
  }

  return DEFAULT_MAP_CENTER;
}

export function distanceMiles(from: GeoPoint, to: GeoPoint): number {
  const earthRadiusMiles = 3958.8;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function matchesDietFilters(restaurant: HealthyRestaurantPlace, selectedDietFilters: RestaurantDietFilter[]): boolean {
  return selectedDietFilters.every((filter) => restaurant.dietTags.includes(filter));
}

function matchesRestaurantQuery(restaurant: HealthyRestaurantPlace, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const searchText = normalizeSearchText([
    restaurant.name,
    restaurant.chain,
    restaurant.category,
    restaurant.city,
    restaurant.state,
    ...restaurant.menuHighlights,
    ...restaurant.dietTags,
  ].join(" "));

  return searchText.includes(normalizedQuery);
}

function compareRestaurantResults(left: RestaurantMapResult, right: RestaurantMapResult): number {
  if (left.distanceMiles !== null && right.distanceMiles !== null && left.distanceMiles !== right.distanceMiles) {
    return left.distanceMiles - right.distanceMiles;
  }

  return left.name.localeCompare(right.name);
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
