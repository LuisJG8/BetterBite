import { describe, expect, it } from "vitest";
import {
  distanceMiles,
  filterHealthyRestaurants,
  getMapCenterForLocationState,
  isBetterBiteApprovedRestaurant,
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
    rating: "4.8",
    eta: "20-30 min",
    imageSrc: "https://example.com/bowl.jpg",
    coordinates: { latitude: 30.2672, longitude: -97.7431 },
    dietTags: ["gluten-free", "vegan", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["olive oil bowls", "roasted vegetables"],
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
    rating: "4.7",
    eta: "15-25 min",
    imageSrc: "https://example.com/burger.jpg",
    coordinates: { latitude: 30.3072, longitude: -97.7431 },
    dietTags: ["gluten-free"],
    healthCriteria: {
      avoidsSeedOils: true,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["grass-fed burger", "avocado oil chips"],
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
    rating: "4.6",
    eta: "25-35 min",
    imageSrc: "https://example.com/cafe.jpg",
    coordinates: { latitude: 30.3272, longitude: -97.7431 },
    dietTags: ["vegan", "vegetarian"],
    healthCriteria: {
      avoidsSeedOils: false,
      noArtificialColors: true,
      minimallyProcessedMenu: true,
    },
    menuHighlights: ["seed oil fryer"],
    verificationNote: "test",
  },
];

describe("restaurant map helpers", () => {
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

  it("uses user location as map center before falling back to restaurants", () => {
    const userLocation = { latitude: 25.7617, longitude: -80.1918 };
    const results = filterHealthyRestaurants({ restaurants: testRestaurants });

    expect(getMapCenterForLocationState(userLocation, results)).toEqual(userLocation);
    expect(getMapCenterForLocationState(null, results)).toEqual(testRestaurants[1].coordinates);
    expect(getMapCenterForLocationState(null, results.slice(0, 1))).toEqual(testRestaurants[1].coordinates);
    expect(getMapCenterForLocationState(null, [])).toEqual({ latitude: 39.8283, longitude: -98.5795 });
  });
});
