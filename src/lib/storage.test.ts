import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVITY_KEY,
  appendSavedSwapHistory,
  loadActivityDays,
  loadOnboardingProfile,
  loadSavedSwapHistory,
  loadScanHistory,
  loadSettings,
  ONBOARDING_KEY,
  recordActivity,
  saveActivityDays,
  saveSavedSwapHistory,
  saveOnboardingProfile,
  saveScanHistory,
  saveSettings,
  SAVED_SWAP_HISTORY_KEY,
  SCAN_HISTORY_KEY,
  SETTINGS_KEY,
} from "./storage";
import type { SavedSwapHistoryItem } from "../types";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  clear(): void {
    this.values.clear();
  }
}

class ThrowingStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error("storage unavailable");
  }
}

describe("storage helpers", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  it("filters corrupted scan history instead of returning unsafe shapes", () => {
    localStorage.setItem(
      SCAN_HISTORY_KEY,
      JSON.stringify([
        { barcode: "12345678", productName: "Apple", score: 11.4, scannedAt: "2026-05-29T00:00:00.000Z" },
        { barcode: "87654321", productName: "Bad Image", score: 5, scannedAt: "2026-05-29T00:00:00.000Z", imageUrl: "javascript:alert(1)" },
        { barcode: "bad", productName: "Bad barcode", score: 5, scannedAt: "2026-05-29T00:00:00.000Z" },
        { barcode: "12345678", productName: "Bad date", score: 5, scannedAt: "not-a-date" },
      ]),
    );

    expect(loadScanHistory()).toEqual([
      { barcode: "12345678", productName: "Apple", score: 10, scannedAt: "2026-05-29T00:00:00.000Z" },
      { barcode: "87654321", productName: "Bad Image", score: 5, scannedAt: "2026-05-29T00:00:00.000Z" },
    ]);
  });

  it("persists only safe scan history fields", () => {
    saveScanHistory([
      {
        barcode: "12345678",
        productName: "Apple",
        score: 8,
        scannedAt: "2026-05-29T00:00:00.000Z",
        imageUrl: "https://images.openfoodfacts.org/images/products/123/front.jpg",
      },
    ]);

    expect(loadScanHistory()[0]?.imageUrl).toBe("https://images.openfoodfacts.org/images/products/123/front.jpg");
  });

  it("loads an empty saved swap history safely", () => {
    expect(loadSavedSwapHistory()).toEqual([]);

    localStorage.setItem(SAVED_SWAP_HISTORY_KEY, JSON.stringify({ invalid: true }));
    expect(loadSavedSwapHistory()).toEqual([]);
  });

  it("appends every newly selected saved swap for the same scanned product", () => {
    const first = savedSwapHistoryItem({ id: "save-1", swapId: "sparkling-water", savedAt: "2026-06-12T10:00:00.000Z" });
    const second = savedSwapHistoryItem({ id: "save-2", swapId: "olipop", swapName: "Vintage Cola", savedAt: "2026-06-12T10:05:00.000Z" });

    appendSavedSwapHistory(first);
    appendSavedSwapHistory(second);

    expect(loadSavedSwapHistory().map((item) => item.swap.id)).toEqual(["olipop", "sparkling-water"]);
  });

  it("preserves repeated choices when another swap was selected in between", () => {
    appendSavedSwapHistory(savedSwapHistoryItem({ id: "save-1", swapId: "sparkling-water", savedAt: "2026-06-12T10:00:00.000Z" }));
    appendSavedSwapHistory(savedSwapHistoryItem({ id: "save-2", swapId: "olipop", swapName: "Vintage Cola", savedAt: "2026-06-12T10:05:00.000Z" }));
    appendSavedSwapHistory(savedSwapHistoryItem({ id: "save-3", swapId: "sparkling-water", savedAt: "2026-06-12T10:10:00.000Z" }));

    expect(loadSavedSwapHistory().map((item) => item.id)).toEqual(["save-3", "save-2", "save-1"]);
  });

  it("ignores duplicate taps on the currently saved swap", () => {
    const item = savedSwapHistoryItem({ id: "save-1", swapId: "sparkling-water", savedAt: "2026-06-12T10:00:00.000Z" });

    appendSavedSwapHistory(item);
    appendSavedSwapHistory(savedSwapHistoryItem({ id: "save-duplicate", swapId: "sparkling-water", savedAt: "2026-06-12T10:01:00.000Z" }));

    expect(loadSavedSwapHistory().map((entry) => entry.id)).toEqual(["save-1"]);
  });

  it("filters malformed saved swap history entries", () => {
    localStorage.setItem(
      SAVED_SWAP_HISTORY_KEY,
      JSON.stringify([
        savedSwapHistoryItem({ id: "valid", swapId: "sparkling-water", savedAt: "2026-06-12T10:00:00.000Z" }),
        savedSwapHistoryItem({ id: "bad-image", swapId: "olipop", savedAt: "2026-06-12T10:01:00.000Z", imageUrl: "javascript:alert(1)" }),
        { id: "bad-date", savedAt: "not-a-date", scannedProduct: {}, swap: {} },
        savedSwapHistoryItem({ id: "bad-price", swapId: "tea", savedAt: "2026-06-12T10:03:00.000Z", estimatedPrice: "" }),
      ]),
    );

    expect(loadSavedSwapHistory()).toEqual([
      savedSwapHistoryItem({ id: "bad-image", swapId: "olipop", savedAt: "2026-06-12T10:01:00.000Z", imageUrl: null }),
      savedSwapHistoryItem({ id: "valid", swapId: "sparkling-water", savedAt: "2026-06-12T10:00:00.000Z" }),
    ]);
  });

  it("falls back to default settings when stored settings are invalid", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ strictSeedOilPenalty: "false" }));

    expect(loadSettings()).toEqual({ strictSeedOilPenalty: true });

    saveSettings({ strictSeedOilPenalty: false });
    expect(loadSettings()).toEqual({ strictSeedOilPenalty: false });
  });

  it("persists completed onboarding only when every question group has valid values", () => {
    expect(loadOnboardingProfile()).toEqual({
      mainGoals: [],
      dietPreferences: [],
      foodsToAvoid: [],
      swapStrictness: [],
      completed: false,
    });

    saveOnboardingProfile({
      mainGoals: ["eat-healthier", "energy-focus"],
      dietPreferences: ["vegetarian", "gluten-free"],
      foodsToAvoid: ["seed-oils", "added-sugars"],
      swapStrictness: ["closest-match", "cleaner-ingredients"],
      completed: true,
    });
    expect(loadOnboardingProfile()).toEqual({
      mainGoals: ["eat-healthier", "energy-focus"],
      dietPreferences: ["vegetarian", "gluten-free"],
      foodsToAvoid: ["seed-oils", "added-sugars"],
      swapStrictness: ["closest-match", "cleaner-ingredients"],
      completed: true,
    });

    localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({
        mainGoals: ["pizza", "manage-weight"],
        dietPreferences: ["vegetarian", "daily"],
        foodsToAvoid: ["gmos", "unknown"],
        swapStrictness: ["strict-clean-label", "anything"],
        completed: true,
      }),
    );
    expect(loadOnboardingProfile()).toEqual({
      mainGoals: ["manage-weight"],
      dietPreferences: ["vegetarian"],
      foodsToAvoid: ["gmos"],
      swapStrictness: ["strict-clean-label"],
      completed: true,
    });
  });

  it("does not mark partial onboarding as completed", () => {
    localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({
        mainGoals: ["eat-healthier"],
        dietPreferences: ["vegan"],
        foodsToAvoid: [],
        swapStrictness: ["same-convenience"],
        completed: true,
      }),
    );

    expect(loadOnboardingProfile()).toEqual({
      mainGoals: ["eat-healthier"],
      dietPreferences: ["vegan"],
      foodsToAvoid: [],
      swapStrictness: ["same-convenience"],
      completed: false,
    });
  });

  it("keeps exclusive onboarding options mutually exclusive", () => {
    saveOnboardingProfile({
      mainGoals: ["eat-healthier"],
      dietPreferences: ["no-preference", "vegan", "gluten-free"],
      foodsToAvoid: ["none", "seed-oils", "added-sugars"],
      swapStrictness: ["closest-match"],
      completed: true,
    });

    expect(loadOnboardingProfile()).toEqual({
      mainGoals: ["eat-healthier"],
      dietPreferences: ["no-preference"],
      foodsToAvoid: ["none"],
      swapStrictness: ["closest-match"],
      completed: true,
    });
  });

  it("records multiple activity event types on the same day", () => {
    recordActivity("login", new Date(2026, 4, 31, 9));
    recordActivity("barcode_scan", new Date(2026, 4, 31, 12));
    recordActivity("profile_view", new Date(2026, 4, 31, 18));

    expect(loadActivityDays()).toEqual([
      {
        date: "2026-05-31",
        count: 3,
        events: {
          login: 1,
          barcode_scan: 1,
          profile_view: 1,
        },
      },
    ]);
  });

  it("filters corrupted activity entries and event counts", () => {
    localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify([
        { date: "2026-05-31", count: 2, events: { login: 1, barcode_scan: 1, unknown: 4 } },
        { date: "2026-02-30", count: 1, events: { login: 1 } },
        { date: "2026-06-01", count: -1, events: { login: 1 } },
        { date: "2026-06-02", count: "1", events: { login: 1 } },
        { date: "2026-06-03", count: 1, events: { login: "1", profile_view: Number.NaN } },
      ]),
    );

    expect(loadActivityDays()).toEqual([
      { date: "2026-05-31", count: 2, events: { login: 1, barcode_scan: 1 } },
      { date: "2026-06-03", count: 1, events: {} },
    ]);
  });

  it("retains roughly the last 400 activity days", () => {
    const days = Array.from({ length: 405 }, (_, index) => ({
      date: toDateKey(new Date(2025, 0, 1 + index)),
      count: 1,
      events: { login: 1 },
    }));

    saveActivityDays(days);

    const stored = loadActivityDays();
    expect(stored).toHaveLength(400);
    expect(stored[0]?.date).toBe(toDateKey(new Date(2025, 0, 6)));
    expect(stored.at(-1)?.date).toBe(toDateKey(new Date(2025, 0, 405)));
  });

  it("does not throw when localStorage writes fail", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new ThrowingStorage(),
      configurable: true,
    });

    expect(() =>
      saveScanHistory([{ barcode: "12345678", productName: "Apple", score: 9, scannedAt: "2026-05-29T00:00:00.000Z" }]),
    ).not.toThrow();
    expect(() =>
      saveSavedSwapHistory([savedSwapHistoryItem({ id: "save-1", swapId: "sparkling-water", savedAt: "2026-06-12T10:00:00.000Z" })]),
    ).not.toThrow();
    expect(() => saveSettings({ strictSeedOilPenalty: false })).not.toThrow();
    expect(() =>
      saveOnboardingProfile({
        mainGoals: ["eat-healthier"],
        dietPreferences: ["vegan"],
        foodsToAvoid: ["none"],
        swapStrictness: ["closest-match"],
        completed: true,
      }),
    ).not.toThrow();
    expect(() => saveActivityDays([{ date: "2026-05-31", count: 1, events: { login: 1 } }])).not.toThrow();
    expect(() => recordActivity("login", new Date(2026, 4, 31))).not.toThrow();
  });
});

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function savedSwapHistoryItem({
  id,
  swapId,
  savedAt,
  swapName = "Sparkling water",
  estimatedPrice = "$4.99",
  imageUrl = "https://images.openfoodfacts.org/images/products/544/900/000/0996/front.jpg",
}: {
  id: string;
  swapId: string;
  savedAt: string;
  swapName?: string;
  estimatedPrice?: string;
  imageUrl?: string | null;
}): SavedSwapHistoryItem {
  const item: SavedSwapHistoryItem = {
    id,
    savedAt,
    scannedProduct: {
      barcode: "5449000000996",
      name: "Original Taste",
      brand: "Coca-Cola",
      score: 4,
      scannedAt: "2026-06-12T09:55:00.000Z",
    },
    swap: {
      id: swapId,
      name: swapName,
      category: "Soda",
      reason: "Carbonated, unsweetened, and usually ingredient-light.",
      scoreHint: "Often 9-10",
      similarityReason: "Keeps the cold, bubbly drinking experience.",
      estimatedPrice,
    },
  };

  if (typeof imageUrl === "string" && imageUrl) {
    item.scannedProduct.imageUrl = imageUrl;
  }

  return item;
}
