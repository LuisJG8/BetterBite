import type {
  ActivityDay,
  ActivityEventCounts,
  ActivityEventType,
  AppSettings,
  DietPreference,
  FoodAvoidance,
  MainGoal,
  OnboardingProfile,
  SavedSwapHistoryItem,
  ScanHistoryItem,
  SwapStrictness,
} from "../types";
import { getBarcodeError } from "./barcode";
import { safeOpenFoodFactsImageUrl } from "./sanitize";

export const ACTIVITY_KEY = "betterbite.activity.v1";
export const ONBOARDING_KEY = "betterbite.onboarding.v2";
export const SAVED_SWAP_HISTORY_KEY = "betterbite.savedSwapHistory.v1";
export const SCAN_HISTORY_KEY = "betterbite.scanHistory.v1";
export const SETTINGS_KEY = "betterbite.settings.v1";

const ACTIVITY_RETENTION_DAYS = 400;
const SAVED_SWAP_HISTORY_LIMIT = 100;
const ACTIVITY_EVENT_TYPES = new Set<ActivityEventType>(["barcode_scan", "profile_view", "login"]);
const MAIN_GOALS: MainGoal[] = [
  "eat-healthier",
  "energy-focus",
  "manage-weight",
  "fitness-goals",
  "reduce-inflammation",
  "long-term-health",
];
const DIET_PREFERENCES: DietPreference[] = ["no-preference", "vegetarian", "vegan", "pescatarian", "keto-low-carb", "gluten-free", "dairy-free"];
const FOODS_TO_AVOID: FoodAvoidance[] = [
  "none",
  "seed-oils",
  "added-sugars",
  "artificial-sweeteners",
  "artificial-colors",
  "high-sodium",
  "gluten",
  "dairy",
  "gmos",
];
const SWAP_STRICTNESS: SwapStrictness[] = [
  "closest-match",
  "cleaner-ingredients",
  "lower-sugar-sodium",
  "avoid-seed-oils",
  "same-convenience",
  "strict-clean-label",
];
const DEFAULT_DISPLAY_NAME = "BetterBite User";
const DEFAULT_EMAIL = "";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_SETTINGS: AppSettings = {
  strictSeedOilPenalty: true,
};

const DEFAULT_ONBOARDING_PROFILE: OnboardingProfile = {
  displayName: DEFAULT_DISPLAY_NAME,
  email: DEFAULT_EMAIL,
  mainGoals: [],
  dietPreferences: [],
  foodsToAvoid: [],
  swapStrictness: [],
  completed: false,
};

export function loadActivityDays(): ActivityDay[] {
  const value = readJson<unknown>(ACTIVITY_KEY, []);

  if (!Array.isArray(value)) {
    return [];
  }

  return sanitizeActivityDays(value);
}

export function saveActivityDays(days: ActivityDay[]): void {
  writeJson(ACTIVITY_KEY, sanitizeActivityDays(days));
}

export function recordActivity(type: ActivityEventType, date = new Date()): ActivityDay[] {
  const dateKey = toLocalDateKey(date);
  const existing = loadActivityDays();
  const byDate = new Map(existing.map((day) => [day.date, day]));
  const current = byDate.get(dateKey) ?? { date: dateKey, count: 0, events: {} };
  const nextEvents: ActivityEventCounts = {
    ...current.events,
    [type]: (current.events[type] ?? 0) + 1,
  };

  byDate.set(dateKey, {
    date: dateKey,
    count: current.count + 1,
    events: nextEvents,
  });

  const next = sanitizeActivityDays(Array.from(byDate.values()));
  writeJson(ACTIVITY_KEY, next);
  return next;
}

export function loadScanHistory(): ScanHistoryItem[] {
  const value = readJson<unknown>(SCAN_HISTORY_KEY, []);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(toScanHistoryItem).filter((item): item is ScanHistoryItem => item !== null).slice(0, 20);
}

export function saveScanHistory(items: ScanHistoryItem[]): void {
  const safeItems = items.map(toScanHistoryItem).filter((item): item is ScanHistoryItem => item !== null).slice(0, 20);
  writeJson(SCAN_HISTORY_KEY, safeItems);
}

export function upsertScanHistory(item: ScanHistoryItem): ScanHistoryItem[] {
  const existing = loadScanHistory().filter((entry) => entry.barcode !== item.barcode);
  const next = [item, ...existing].slice(0, 20);
  saveScanHistory(next);
  return next;
}

export function loadSavedSwapHistory(): SavedSwapHistoryItem[] {
  const value = readJson<unknown>(SAVED_SWAP_HISTORY_KEY, []);

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(toSavedSwapHistoryItem)
    .filter((item): item is SavedSwapHistoryItem => item !== null)
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))
    .slice(0, SAVED_SWAP_HISTORY_LIMIT);
}

export function saveSavedSwapHistory(items: SavedSwapHistoryItem[]): void {
  const safeItems = items
    .map(toSavedSwapHistoryItem)
    .filter((item): item is SavedSwapHistoryItem => item !== null)
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))
    .slice(0, SAVED_SWAP_HISTORY_LIMIT);

  writeJson(SAVED_SWAP_HISTORY_KEY, safeItems);
}

export function appendSavedSwapHistory(item: SavedSwapHistoryItem): SavedSwapHistoryItem[] {
  const safeItem = toSavedSwapHistoryItem(item);
  const existing = loadSavedSwapHistory();

  if (!safeItem) {
    return existing;
  }

  const latestForScannedProduct = existing.find((entry) => entry.scannedProduct.barcode === safeItem.scannedProduct.barcode);
  if (latestForScannedProduct?.swap.id === safeItem.swap.id) {
    return existing;
  }

  const next = [safeItem, ...existing].slice(0, SAVED_SWAP_HISTORY_LIMIT);
  saveSavedSwapHistory(next);
  return next;
}

export function loadOnboardingProfile(): OnboardingProfile {
  return toOnboardingProfile(readJson<unknown>(ONBOARDING_KEY, {}));
}

export function saveOnboardingProfile(profile: OnboardingProfile): OnboardingProfile {
  const safeProfile = toOnboardingProfile(profile);
  writeJson(ONBOARDING_KEY, safeProfile);
  return safeProfile;
}

export function loadSettings(): AppSettings {
  const value = readJson<unknown>(SETTINGS_KEY, {});

  return {
    ...DEFAULT_SETTINGS,
    ...(isRecord(value) && typeof value.strictSeedOilPenalty === "boolean"
      ? { strictSeedOilPenalty: value.strictSeedOilPenalty }
      : {}),
  };
}

export function saveSettings(settings: AppSettings): void {
  writeJson(SETTINGS_KEY, {
    strictSeedOilPenalty: Boolean(settings.strictSeedOilPenalty),
  });
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience cache; failed writes should not break scanning.
  }
}

function toScanHistoryItem(value: unknown): ScanHistoryItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.barcode !== "string" || getBarcodeError(value.barcode)) {
    return null;
  }

  const productName = trimText(value.productName, 120);
  const scannedAt = trimText(value.scannedAt, 40);

  if (!productName || !scannedAt || Number.isNaN(Date.parse(scannedAt)) || typeof value.score !== "number" || !Number.isFinite(value.score)) {
    return null;
  }

  const item: ScanHistoryItem = {
    barcode: value.barcode,
    productName,
    score: Math.min(10, Math.max(1, Math.round(value.score))),
    scannedAt,
  };

  const brand = trimText(value.brand, 80);
  if (brand) {
    item.brand = brand;
  }

  const imageUrl = safeOpenFoodFactsImageUrl(value.imageUrl);
  if (imageUrl) {
    item.imageUrl = imageUrl;
  }

  return item;
}

function toSavedSwapHistoryItem(value: unknown): SavedSwapHistoryItem | null {
  if (!isRecord(value) || !isRecord(value.scannedProduct) || !isRecord(value.swap)) {
    return null;
  }

  const id = trimText(value.id, 140);
  const savedAt = trimText(value.savedAt, 40);
  if (!id || !savedAt || Number.isNaN(Date.parse(savedAt))) {
    return null;
  }

  const scannedProduct = toSavedSwapScannedProduct(value.scannedProduct);
  const swap = toSavedSwapProduct(value.swap);
  if (!scannedProduct || !swap) {
    return null;
  }

  return {
    id,
    savedAt,
    scannedProduct,
    swap,
  };
}

function toSavedSwapScannedProduct(value: Record<string, unknown>): SavedSwapHistoryItem["scannedProduct"] | null {
  if (typeof value.barcode !== "string" || getBarcodeError(value.barcode)) {
    return null;
  }

  const name = trimText(value.name, 120);
  const scannedAt = trimText(value.scannedAt, 40);
  if (!name || !scannedAt || Number.isNaN(Date.parse(scannedAt)) || typeof value.score !== "number" || !Number.isFinite(value.score)) {
    return null;
  }

  const scannedProduct: SavedSwapHistoryItem["scannedProduct"] = {
    barcode: value.barcode,
    name,
    score: Math.min(10, Math.max(1, Math.round(value.score))),
    scannedAt,
  };

  const brand = trimText(value.brand, 80);
  if (brand) {
    scannedProduct.brand = brand;
  }

  const imageUrl = safeOpenFoodFactsImageUrl(value.imageUrl);
  if (imageUrl) {
    scannedProduct.imageUrl = imageUrl;
  }

  return scannedProduct;
}

function toSavedSwapProduct(value: Record<string, unknown>): SavedSwapHistoryItem["swap"] | null {
  const id = trimText(value.id, 120);
  const name = trimText(value.name, 120);
  const category = trimText(value.category, 80);
  const reason = trimText(value.reason, 280);
  const scoreHint = trimText(value.scoreHint, 80);
  const estimatedPrice = trimText(value.estimatedPrice, 40);

  if (!id || !name || !category || !reason || !scoreHint || !estimatedPrice) {
    return null;
  }

  const swap: SavedSwapHistoryItem["swap"] = {
    id,
    name,
    category,
    reason,
    scoreHint,
    estimatedPrice,
  };

  const brand = trimText(value.brand, 80);
  if (brand) {
    swap.brand = brand;
  }

  const similarityReason = trimText(value.similarityReason, 260);
  if (similarityReason) {
    swap.similarityReason = similarityReason;
  }

  return swap;
}

function toOnboardingProfile(value: unknown): OnboardingProfile {
  if (!isRecord(value)) {
    return DEFAULT_ONBOARDING_PROFILE;
  }

  const displayName = trimText(value.displayName, 80) || DEFAULT_DISPLAY_NAME;
  const email = sanitizeEmail(value.email);
  const mainGoals = sanitizeOptionArray(value.mainGoals, MAIN_GOALS);
  const dietPreferences = sanitizeOptionArray(value.dietPreferences, DIET_PREFERENCES, "no-preference");
  const foodsToAvoid = sanitizeOptionArray(value.foodsToAvoid, FOODS_TO_AVOID, "none");
  const swapStrictness = sanitizeOptionArray(value.swapStrictness, SWAP_STRICTNESS);

  return {
    displayName,
    email,
    mainGoals,
    dietPreferences,
    foodsToAvoid,
    swapStrictness,
    completed: Boolean(value.completed && mainGoals.length && dietPreferences.length && foodsToAvoid.length),
  };
}

function sanitizeOptionArray<T extends string>(value: unknown, allowed: T[], exclusiveValue?: T): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedValues = new Set(allowed);
  const selected = value.filter((item): item is T => typeof item === "string" && allowedValues.has(item as T));
  const selectedValues = new Set(selected);
  const uniqueSelected = allowed.filter((item) => selectedValues.has(item));

  if (exclusiveValue && uniqueSelected.includes(exclusiveValue)) {
    return [exclusiveValue];
  }

  return uniqueSelected;
}

function sanitizeActivityDays(values: unknown[]): ActivityDay[] {
  return values
    .map(toActivityDay)
    .filter((day): day is ActivityDay => day !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-ACTIVITY_RETENTION_DAYS);
}

function toActivityDay(value: unknown): ActivityDay | null {
  if (!isRecord(value)) {
    return null;
  }

  const date = trimText(value.date, 10);
  if (!isValidDateKey(date) || typeof value.count !== "number" || !Number.isFinite(value.count)) {
    return null;
  }

  const count = Math.round(value.count);
  if (count < 0) {
    return null;
  }

  return {
    date,
    count,
    events: toActivityEventCounts(value.events),
  };
}

function toActivityEventCounts(value: unknown): ActivityEventCounts {
  if (!isRecord(value)) {
    return {};
  }

  const events: ActivityEventCounts = {};
  for (const [type, count] of Object.entries(value)) {
    if (ACTIVITY_EVENT_TYPES.has(type as ActivityEventType) && typeof count === "number" && Number.isFinite(count) && count > 0) {
      const safeCount = Math.round(count);
      if (safeCount > 0) {
        events[type as ActivityEventType] = safeCount;
      }
    }
  }

  return events;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function sanitizeEmail(value: unknown): string {
  const email = trimText(value, 160).toLowerCase();
  return !email || EMAIL_PATTERN.test(email) ? email : DEFAULT_EMAIL;
}
