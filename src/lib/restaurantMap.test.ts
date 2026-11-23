import { describe, expect, it } from "vitest";
import {
  distanceMiles,
  filterHealthyRestaurants,
  getNearestRestaurantId,
  getPreferredRestaurantId,
  HEALTHY_RESTAURANT_PLACES,
  isBetterBiteApprovedRestaurant,
  RESTAURANT_PRICE_RANGES,
  RESTAURANT_RATING_RANGES,
  type HealthyRestaurantPlace,
} from "./restaurantMap";

const testRestaurants: HealthyRestaurantPlace[] = [
  {
    id: "approved-vegan",
    name: "Approved Vegan Bowl",
    chain: "Approved Bowl",
    category: "Bowls",
    address: "1 Test St",
    city: "Austin",
    state: "TX",
    logoSrc: "https://example.com/logo.png",
    coordinates: { latitude: 30.2672, longitude: -97.7431 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      noArtificialSweeteners: true,
      minimallyProcessedMenu: true,
      wholeFoodForward: true,
    },
    verification: {
      status: "verified",
      reviewedAt: "2026-07-30",
      standardsUrl: "https://example.com/standards",
      locationUrl: "https://example.com/locations/approved-vegan",
    },
    menuHighlights: ["olive oil bowls", "roasted vegetables"],
    publicDetails: {
      googleRating: 4.7,
      googleReviewCount: 120,
      googleReviewsUrl: "https://example.com/reviews/approved-vegan",
      photoSources: ["https://example.com/approved-vegan-1.jpg", "https://example.com/approved-vegan-2.jpg"],
      pricePerPersonEstimate: 24,
    },
    verificationNote: "test",
  },
  {
    id: "approved-burger",
    name: "Approved Burger",
    chain: "Pasture Press",
    category: "Cleaner burger counter",
    address: "2 Test St",
    city: "Austin",
    state: "TX",
    logoSrc: "https://example.com/logo.png",
    coordinates: { latitude: 30.3072, longitude: -97.7431 },
    dietTags: ["gluten-free"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      noArtificialSweeteners: true,
      minimallyProcessedMenu: true,
      wholeFoodForward: true,
    },
    verification: {
      status: "verified",
      reviewedAt: "2026-07-30",
      standardsUrl: "https://example.com/standards",
      locationUrl: "https://example.com/locations/approved-burger",
    },
    menuHighlights: ["grass-fed burger", "avocado oil chips"],
    publicDetails: {
      googleRating: 4.2,
      googleReviewCount: 80,
      googleReviewsUrl: "https://example.com/reviews/approved-burger",
      photoSources: ["https://example.com/approved-burger-1.jpg", "https://example.com/approved-burger-2.jpg"],
      pricePerPersonEstimate: 14,
    },
    verificationNote: "test",
  },
  {
    id: "unapproved",
    name: "Unapproved Vegan Cafe",
    chain: "Unapproved",
    category: "Cafe",
    address: "3 Test St",
    city: "Austin",
    state: "TX",
    logoSrc: "https://example.com/logo.png",
    coordinates: { latitude: 30.3272, longitude: -97.7431 },
    dietTags: ["vegan", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: false,
      noArtificialColors: true,
      noArtificialSweeteners: true,
      minimallyProcessedMenu: true,
      wholeFoodForward: true,
    },
    verification: {
      status: "verified",
      reviewedAt: "2026-07-30",
      standardsUrl: "https://example.com/standards",
      locationUrl: "https://example.com/locations/unapproved",
    },
    menuHighlights: ["seed oil fryer"],
    verificationNote: "test",
  },
];

describe("restaurant map helpers", () => {
  it("pins every published restaurant to the coordinate on its official location page", () => {
    expect(
      Object.fromEntries(
        HEALTHY_RESTAURANT_PLACES.map((restaurant) => [restaurant.id, restaurant.coordinates]),
      ),
    ).toEqual({
      "true-food-kitchen-austin": { latitude: 30.2670001, longitude: -97.7522838 },
      "true-food-kitchen-bethesda": { latitude: 38.9801769, longitude: -77.0924366 },
      "true-food-kitchen-century-city": { latitude: 34.0581627, longitude: -118.417339 },
      "true-food-kitchen-chicago": { latitude: 41.893954, longitude: -87.628365 },
      "true-food-kitchen-dallas": { latitude: 32.8640947, longitude: -96.8033337 },
      "true-food-kitchen-miami": { latitude: 25.6438622, longitude: -80.3374813 },
    });
  });

  it("provides sourced photos and Google review details for every published place", () => {
    for (const restaurant of HEALTHY_RESTAURANT_PLACES) {
      expect(restaurant.publicDetails?.photoSources).toHaveLength(2);
      expect(restaurant.publicDetails?.googleRating).toBeGreaterThanOrEqual(4);
      expect(restaurant.publicDetails?.googleReviewCount).toBeGreaterThan(0);
      expect(restaurant.publicDetails?.pricePerPersonEstimate).toBeGreaterThanOrEqual(1);
      expect(restaurant.publicDetails?.pricePerPersonEstimate).toBeLessThanOrEqual(100);
      expect(restaurant.publicDetails?.googleReviewsUrl).toMatch(/^https:\/\/search\.google\.com\/local\/reviews\?placeid=/);
    }
  });

  it("requires current verification evidence before a restaurant can appear", () => {
    const unverifiedRestaurant = {
      ...testRestaurants[0],
      verification: {
        status: "pending",
        reviewedAt: "2026-07-30",
        standardsUrl: "https://example.com/standards",
        locationUrl: "https://example.com/location",
      },
    } as HealthyRestaurantPlace & {
      verification: {
        status: string;
        reviewedAt: string;
        standardsUrl: string;
        locationUrl: string;
      };
    };

    expect(isBetterBiteApprovedRestaurant(unverifiedRestaurant)).toBe(false);
    expect(filterHealthyRestaurants({ restaurants: [unverifiedRestaurant] })).toEqual([]);
  });

  it("rejects restaurants that do not meet the whole-food menu standard", () => {
    const junkFoodForwardRestaurant = {
      ...testRestaurants[0],
      id: "junk-food-forward",
      healthCriteria: {
        ...testRestaurants[0].healthCriteria,
        noArtificialSweeteners: true,
        wholeFoodForward: false,
      },
    } as HealthyRestaurantPlace & {
      healthCriteria: HealthyRestaurantPlace["healthCriteria"] & {
        noArtificialSweeteners: boolean;
        wholeFoodForward: boolean;
      };
    };

    expect(isBetterBiteApprovedRestaurant(junkFoodForwardRestaurant)).toBe(false);
  });

  it("rejects restaurant coordinates that cannot be placed accurately on the map", () => {
    const invalidLocation = {
      ...testRestaurants[0],
      coordinates: { latitude: 95, longitude: -97.7431 },
    };

    expect(isBetterBiteApprovedRestaurant(invalidLocation)).toBe(false);
    expect(filterHealthyRestaurants({ restaurants: [invalidLocation] })).toEqual([]);
  });

  it("fails closed when health criteria are not fully approved", () => {
    expect(isBetterBiteApprovedRestaurant(testRestaurants[0])).toBe(true);
    expect(isBetterBiteApprovedRestaurant(testRestaurants[2])).toBe(false);
    expect(filterHealthyRestaurants({ restaurants: testRestaurants }).map((restaurant) => restaurant.id)).not.toContain("unapproved");
  });

  it("filters by gluten-free, vegan, and vegetarian tags", () => {
    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        selectedDietFilters: ["gluten-free"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-burger", "approved-vegan"]);

    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        selectedDietFilters: ["vegan"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-vegan"]);

    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        selectedDietFilters: ["gluten-free", "vegan", "vegetarian"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-vegan"]);
  });

  it("matches any selected per-person price range up to $100", () => {
    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        selectedPriceRanges: ["11-20"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-burger"]);

    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        selectedPriceRanges: ["11-20", "21-30"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-burger", "approved-vegan"]);
  });

  it("provides contiguous price choices with a hard $100 maximum", () => {
    expect(RESTAURANT_PRICE_RANGES.map((range) => range.id)).toEqual([
      "1-10",
      "11-20",
      "21-30",
      "31-40",
      "41-50",
      "51-60",
      "61-70",
      "71-80",
      "81-90",
      "91-100",
    ]);

    const atMaximum = {
      ...testRestaurants[0],
      id: "at-price-maximum",
      publicDetails: { ...testRestaurants[0].publicDetails!, pricePerPersonEstimate: 100 },
    };
    const aboveMaximum = {
      ...testRestaurants[0],
      id: "above-price-maximum",
      publicDetails: { ...testRestaurants[0].publicDetails!, pricePerPersonEstimate: 101 },
    };

    expect(
      filterHealthyRestaurants({
        restaurants: [atMaximum, aboveMaximum],
        selectedPriceRanges: ["91-100"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["at-price-maximum"]);
  });

  it("matches any selected non-overlapping rating band from 3 to 5 stars", () => {
    expect(RESTAURANT_RATING_RANGES.map((range) => range.id)).toEqual([
      "3.0-3.4",
      "3.5-3.9",
      "4.0-4.4",
      "4.5-4.9",
      "5.0",
    ]);

    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        selectedRatingRanges: ["4.5-4.9"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-vegan"]);

    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        selectedRatingRanges: ["4.0-4.4", "4.5-4.9"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-burger", "approved-vegan"]);
  });

  it("combines price, food-option, and rating groups", () => {
    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        selectedPriceRanges: ["21-30"],
        selectedDietFilters: ["vegan", "vegetarian"],
        selectedRatingRanges: ["4.5-4.9"],
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-vegan"]);
  });

  it("searches within the already approved restaurant set", () => {
    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        query: "burger",
      }).map((restaurant) => restaurant.id),
    ).toEqual(["approved-burger"]);

    expect(
      filterHealthyRestaurants({
        restaurants: testRestaurants,
        query: "seed oil fryer",
      }),
    ).toEqual([]);
  });

  it("computes distance and sorts nearby restaurants first", () => {
    const results = filterHealthyRestaurants({
      restaurants: testRestaurants,
      userLocation: { latitude: 30.2672, longitude: -97.7431 },
      maxDistanceMiles: 10,
    });

    expect(results.map((restaurant) => restaurant.id)).toEqual(["approved-vegan", "approved-burger"]);
    expect(results[0].distanceMiles).toBeCloseTo(0);
    expect(distanceMiles({ latitude: 30.2672, longitude: -97.7431 }, { latitude: 30.3072, longitude: -97.7431 })).toBeGreaterThan(2);
  });

  it("keeps nearby discovery at metro scale by default", () => {
    const farAwayRestaurant = {
      ...testRestaurants[0],
      id: "approved-but-far-away",
      name: "Approved but Far Away",
      coordinates: { latitude: 30.8172, longitude: -97.7431 },
    };

    const results = filterHealthyRestaurants({
      restaurants: [...testRestaurants, farAwayRestaurant],
      userLocation: { latitude: 30.2672, longitude: -97.7431 },
    });

    expect(results.map((restaurant) => restaurant.id)).toEqual(["approved-vegan", "approved-burger"]);
  });

  it("automatically opens the closest restaurant while preserving a valid selection", () => {
    const results = filterHealthyRestaurants({
      restaurants: testRestaurants,
      userLocation: { latitude: 30.2672, longitude: -97.7431 },
      maxDistanceMiles: 10,
    });

    expect(getPreferredRestaurantId(results, null)).toBe("approved-vegan");
    expect(getPreferredRestaurantId(results, "approved-burger")).toBe("approved-burger");
  });

  it("identifies the nearest verified pin", () => {
    const results = filterHealthyRestaurants({
      restaurants: testRestaurants,
      userLocation: { latitude: 30.2672, longitude: -97.7431 },
      maxDistanceMiles: 10,
    });

    expect(getNearestRestaurantId(results, true)).toBe("approved-vegan");
    expect(getNearestRestaurantId(results, false)).toBeNull();
  });

});
