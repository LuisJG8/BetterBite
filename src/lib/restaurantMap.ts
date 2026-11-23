export type RestaurantDietFilter = "gluten-free" | "vegan" | "vegetarian";
export type RestaurantPriceRange =
  | "1-10"
  | "11-20"
  | "21-30"
  | "31-40"
  | "41-50"
  | "51-60"
  | "61-70"
  | "71-80"
  | "81-90"
  | "91-100";
export type RestaurantRatingRange = "3.0-3.4" | "3.5-3.9" | "4.0-4.4" | "4.5-4.9" | "5.0";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RestaurantHealthCriteria {
  avoidsSeedOils: boolean;
  noArtificialColors: boolean;
  noArtificialSweeteners: boolean;
  minimallyProcessedMenu: boolean;
  wholeFoodForward: boolean;
}

export interface RestaurantVerification {
  status: "verified" | "pending";
  reviewedAt: string;
  standardsUrl: string;
  locationUrl: string;
}

export interface RestaurantPublicDetails {
  googleRating: number;
  googleReviewCount: number;
  googleReviewsUrl: string;
  photoSources: string[];
  pricePerPersonEstimate: number;
}

export interface HealthyRestaurantPlace {
  id: string;
  name: string;
  chain: string;
  category: string;
  address: string;
  city: string;
  state: string;
  logoSrc: string;
  coordinates: GeoPoint;
  dietTags: RestaurantDietFilter[];
  healthCriteria: RestaurantHealthCriteria;
  verification: RestaurantVerification;
  menuHighlights: string[];
  publicDetails?: RestaurantPublicDetails;
  verificationNote: string;
}

export interface RestaurantMapResult extends HealthyRestaurantPlace {
  distanceMiles: number | null;
}

export interface FilterHealthyRestaurantsOptions {
  restaurants?: HealthyRestaurantPlace[];
  selectedDietFilters?: RestaurantDietFilter[];
  selectedPriceRanges?: RestaurantPriceRange[];
  selectedRatingRanges?: RestaurantRatingRange[];
  query?: string;
  userLocation?: GeoPoint | null;
  maxDistanceMiles?: number;
}

export const RESTAURANT_DIET_FILTERS: Array<{ id: RestaurantDietFilter; label: string }> = [
  { id: "gluten-free", label: "Gluten free" },
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
];

export const RESTAURANT_PRICE_RANGES: Array<{
  id: RestaurantPriceRange;
  label: string;
  min: number;
  maxExclusive: number;
}> = Array.from({ length: 10 }, (_, index) => {
  const min = index * 10 + 1;
  const max = (index + 1) * 10;
  return {
    id: `${min}-${max}` as RestaurantPriceRange,
    label: `$${min}–${max}`,
    min,
    maxExclusive: max + 1,
  };
});

export const RESTAURANT_RATING_RANGES: Array<{
  id: RestaurantRatingRange;
  label: string;
  min: number;
  maxExclusive: number;
}> = [
  { id: "3.0-3.4", label: "3.0–3.4", min: 3, maxExclusive: 3.5 },
  { id: "3.5-3.9", label: "3.5–3.9", min: 3.5, maxExclusive: 4 },
  { id: "4.0-4.4", label: "4.0–4.4", min: 4, maxExclusive: 4.5 },
  { id: "4.5-4.9", label: "4.5–4.9", min: 4.5, maxExclusive: 5 },
  { id: "5.0", label: "5.0", min: 5, maxExclusive: 5.01 },
];

export const DEFAULT_NEARBY_RADIUS_MILES = 25;

const TRUE_FOOD_LOGO_URL = "https://www.truefoodkitchen.com/wp-content/uploads/2025/11/TrueFoodLogoSquare.png";
const TRUE_FOOD_DISH_PHOTO_URL = "https://www.truefoodkitchen.com/wp-content/uploads/2025/09/Ancient-Grain.jpg";
const TRUE_FOOD_STANDARDS_URL = "https://www.truefoodkitchen.com/truestory/";
const TRUE_FOOD_HEALTH_CRITERIA: RestaurantHealthCriteria = {
  avoidsSeedOils: true,
  noArtificialColors: true,
  noArtificialSweeteners: true,
  minimallyProcessedMenu: true,
  wholeFoodForward: true,
};

function createTrueFoodVerification(locationSlug: string): RestaurantVerification {
  return {
    status: "verified",
    reviewedAt: "2026-07-30",
    standardsUrl: TRUE_FOOD_STANDARDS_URL,
    locationUrl: `https://www.truefoodkitchen.com/locations/${locationSlug}/`,
  };
}

function createTrueFoodPublicDetails({
  googlePlaceId,
  googleRating,
  googleReviewCount,
  locationPhotoSlug,
  pricePerPersonEstimate,
}: {
  googlePlaceId: string;
  googleRating: number;
  googleReviewCount: number;
  locationPhotoSlug: string;
  pricePerPersonEstimate: number;
}): RestaurantPublicDetails {
  return {
    googleRating,
    googleReviewCount,
    googleReviewsUrl: `https://search.google.com/local/reviews?placeid=${googlePlaceId}`,
    photoSources: [
      `https://www.truefoodkitchen.com/wp-content/uploads/2026/05/${locationPhotoSlug}.webp`,
      TRUE_FOOD_DISH_PHOTO_URL,
    ],
    pricePerPersonEstimate,
  };
}

// Each coordinate mirrors the structured map metadata on its official
// verification.locationUrl as of verification.reviewedAt.
export const HEALTHY_RESTAURANT_PLACES: HealthyRestaurantPlace[] = [
  {
    id: "true-food-kitchen-austin",
    name: "True Food Kitchen - Austin Seaholm",
    chain: "True Food Kitchen",
    category: "Anti-inflammatory bowls & plates",
    address: "222 W. Avenue Ste HR100",
    city: "Austin",
    state: "TX",
    logoSrc: TRUE_FOOD_LOGO_URL,
    coordinates: { latitude: 30.2670001, longitude: -97.7522838 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: TRUE_FOOD_HEALTH_CRITERIA,
    verification: createTrueFoodVerification("austin"),
    menuHighlights: ["Ancient Grains Bowl", "Grass-Fed Burger", "Seasonal vegetables"],
    publicDetails: createTrueFoodPublicDetails({
      googlePlaceId: "ChIJB_bjLg61RIYRrBuIICDuw90",
      googleRating: 4.5,
      googleReviewCount: 2_833,
      locationPhotoSlug: "austin",
      pricePerPersonEstimate: 29,
    }),
    verificationNote: "Published standards say the menu is seed-oil free and centered on whole, minimally processed ingredients.",
  },
  {
    id: "true-food-kitchen-century-city",
    name: "True Food Kitchen - Century City",
    chain: "True Food Kitchen",
    category: "Seasonal whole-food cooking",
    address: "10250 Santa Monica Blvd Suite 1400",
    city: "Los Angeles",
    state: "CA",
    logoSrc: TRUE_FOOD_LOGO_URL,
    coordinates: { latitude: 34.0581627, longitude: -118.417339 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: TRUE_FOOD_HEALTH_CRITERIA,
    verification: createTrueFoodVerification("century-city"),
    menuHighlights: ["Ancient Grains Bowl", "Spaghetti Squash Casserole", "Seasonal plates"],
    publicDetails: createTrueFoodPublicDetails({
      googlePlaceId: "ChIJr91ibla7woARESWbIB7cc-8",
      googleRating: 4.4,
      googleReviewCount: 402,
      locationPhotoSlug: "la-centurycity",
      pricePerPersonEstimate: 35,
    }),
    verificationNote: "Published standards say the menu is seed-oil free and centered on whole, minimally processed ingredients.",
  },
  {
    id: "true-food-kitchen-bethesda",
    name: "True Food Kitchen - Bethesda",
    chain: "True Food Kitchen",
    category: "Whole-food bowls, burgers & plates",
    address: "7100 Wisconsin Ave",
    city: "Bethesda",
    state: "MD",
    logoSrc: TRUE_FOOD_LOGO_URL,
    coordinates: { latitude: 38.9801769, longitude: -77.0924366 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: TRUE_FOOD_HEALTH_CRITERIA,
    verification: createTrueFoodVerification("bethesda"),
    menuHighlights: ["Grass-Fed Burger", "Korean Noodle Bowl", "Spaghetti Squash Casserole"],
    publicDetails: createTrueFoodPublicDetails({
      googlePlaceId: "ChIJtVJcPHrJt4kR75IULnVREdk",
      googleRating: 4.4,
      googleReviewCount: 1_712,
      locationPhotoSlug: "bethesda",
      pricePerPersonEstimate: 31,
    }),
    verificationNote: "Published standards say the menu is seed-oil free and centered on whole, minimally processed ingredients.",
  },
  {
    id: "true-food-kitchen-miami",
    name: "True Food Kitchen - Miami",
    chain: "True Food Kitchen",
    category: "Seasonal anti-inflammatory plates",
    address: "8888 SW 136 Street, Suite 340A",
    city: "Miami",
    state: "FL",
    logoSrc: TRUE_FOOD_LOGO_URL,
    coordinates: { latitude: 25.6438622, longitude: -80.3374813 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: TRUE_FOOD_HEALTH_CRITERIA,
    verification: createTrueFoodVerification("miami"),
    menuHighlights: ["Spicy Panang Curry", "Teriyaki Rice Bowl", "True Crisp'd Chicken"],
    publicDetails: createTrueFoodPublicDetails({
      googlePlaceId: "ChIJ82lL2HTH2YgRd51iziCQHUc",
      googleRating: 4.8,
      googleReviewCount: 2_763,
      locationPhotoSlug: "miami",
      pricePerPersonEstimate: 36,
    }),
    verificationNote: "Published standards say the menu is seed-oil free and centered on whole, minimally processed ingredients.",
  },
  {
    id: "true-food-kitchen-chicago",
    name: "True Food Kitchen - Chicago",
    chain: "True Food Kitchen",
    category: "Seasonal whole-food dining",
    address: "1 West Erie St Unit A/Floor 1",
    city: "Chicago",
    state: "IL",
    logoSrc: TRUE_FOOD_LOGO_URL,
    coordinates: { latitude: 41.893954, longitude: -87.628365 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: TRUE_FOOD_HEALTH_CRITERIA,
    verification: createTrueFoodVerification("chicago"),
    menuHighlights: ["Ancient Grains Bowl", "Grass-Fed Burger", "Spicy Panang Curry"],
    publicDetails: createTrueFoodPublicDetails({
      googlePlaceId: "ChIJG4G-Ya0sDogRoHaQXnpcG74",
      googleRating: 4.5,
      googleReviewCount: 2_664,
      locationPhotoSlug: "chicago",
      pricePerPersonEstimate: 32,
    }),
    verificationNote: "Published standards say the menu is seed-oil free and centered on whole, minimally processed ingredients.",
  },
  {
    id: "true-food-kitchen-dallas",
    name: "True Food Kitchen - Dallas",
    chain: "True Food Kitchen",
    category: "Nutrient-dense bowls & comfort food",
    address: "8383 Preston Center Plaza Ste 100",
    city: "Dallas",
    state: "TX",
    logoSrc: TRUE_FOOD_LOGO_URL,
    coordinates: { latitude: 32.8640947, longitude: -96.8033337 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: TRUE_FOOD_HEALTH_CRITERIA,
    verification: createTrueFoodVerification("dallas"),
    menuHighlights: ["Ancient Grains Bowl", "Korean Noodle Bowl", "True Crisp'd Chicken"],
    publicDetails: createTrueFoodPublicDetails({
      googlePlaceId: "ChIJD-0-iUWeToYRDA4MiB2Qrws",
      googleRating: 4.4,
      googleReviewCount: 1_529,
      locationPhotoSlug: "dallas",
      pricePerPersonEstimate: 28,
    }),
    verificationNote: "Published standards say the menu is seed-oil free and centered on whole, minimally processed ingredients.",
  },
];

export function filterHealthyRestaurants({
  restaurants = HEALTHY_RESTAURANT_PLACES,
  selectedDietFilters = [],
  selectedPriceRanges = [],
  selectedRatingRanges = [],
  query = "",
  userLocation = null,
  maxDistanceMiles = DEFAULT_NEARBY_RADIUS_MILES,
}: FilterHealthyRestaurantsOptions = {}): RestaurantMapResult[] {
  const normalizedQuery = normalizeSearchText(query);

  return restaurants
    .filter(isBetterBiteApprovedRestaurant)
    .filter((restaurant) => matchesDietFilters(restaurant, selectedDietFilters))
    .filter((restaurant) => matchesPriceRanges(restaurant, selectedPriceRanges))
    .filter((restaurant) => matchesRatingRanges(restaurant, selectedRatingRanges))
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
    restaurant.healthCriteria.noArtificialSweeteners &&
    restaurant.healthCriteria.minimallyProcessedMenu &&
    restaurant.healthCriteria.wholeFoodForward &&
    isValidGeoPoint(restaurant.coordinates) &&
    restaurant.verification?.status === "verified" &&
    isValidVerificationDate(restaurant.verification.reviewedAt) &&
    isSecureEvidenceUrl(restaurant.verification.standardsUrl) &&
    isSecureEvidenceUrl(restaurant.verification.locationUrl)
  );
}

export function getPreferredRestaurantId(
  restaurants: RestaurantMapResult[],
  selectedRestaurantId: string | null,
): string | null {
  if (selectedRestaurantId && restaurants.some((restaurant) => restaurant.id === selectedRestaurantId)) {
    return selectedRestaurantId;
  }

  return restaurants[0]?.id ?? null;
}

export function getNearestRestaurantId(restaurants: RestaurantMapResult[], locationReady: boolean): string | null {
  return locationReady ? restaurants[0]?.id ?? null : null;
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

function matchesPriceRanges(restaurant: HealthyRestaurantPlace, selectedPriceRanges: RestaurantPriceRange[]): boolean {
  if (selectedPriceRanges.length === 0) {
    return true;
  }

  const estimate = restaurant.publicDetails?.pricePerPersonEstimate;
  if (!Number.isFinite(estimate) || estimate === undefined || estimate < 1 || estimate > 100) {
    return false;
  }

  const roundedEstimate = Math.ceil(estimate);
  return selectedPriceRanges.some((selectedRange) => {
    const range = RESTAURANT_PRICE_RANGES.find(({ id }) => id === selectedRange);
    return Boolean(range && roundedEstimate >= range.min && roundedEstimate < range.maxExclusive);
  });
}

function matchesRatingRanges(restaurant: HealthyRestaurantPlace, selectedRatingRanges: RestaurantRatingRange[]): boolean {
  if (selectedRatingRanges.length === 0) {
    return true;
  }

  const rating = restaurant.publicDetails?.googleRating;
  if (!Number.isFinite(rating) || rating === undefined || rating < 3 || rating > 5) {
    return false;
  }

  return selectedRatingRanges.some((selectedRange) => {
    const range = RESTAURANT_RATING_RANGES.find(({ id }) => id === selectedRange);
    return Boolean(range && rating >= range.min && rating < range.maxExclusive);
  });
}

function matchesRestaurantQuery(restaurant: HealthyRestaurantPlace, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const searchText = normalizeSearchText([
    restaurant.name,
    restaurant.chain,
    restaurant.category,
    restaurant.address,
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

function isSecureEvidenceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isValidVerificationDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidGeoPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
