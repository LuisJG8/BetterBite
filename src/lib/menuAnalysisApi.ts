import type {
  MenuAnalysis,
  MenuConcern,
  MenuCravingCategory,
  MenuDish,
  MenuEvidenceLevel,
} from "../types";

export const MENU_PAGE_LIMIT = 6;
export const MENU_PAGE_MAX_BYTES = 8 * 1024 * 1024;
export const MENU_UPLOAD_MAX_BYTES = 24 * 1024 * 1024;

const MENU_RESPONSE_MAX_CHARACTERS = 1_000_000;
const MENU_DISH_LIMIT = 200;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MENU_CATEGORIES = new Set<MenuCravingCategory>([
  "burgers",
  "chicken",
  "pizza",
  "tacos",
  "bowls",
  "salads",
  "sides",
  "drinks",
  "desserts",
  "other",
]);
const MENU_CONCERNS = new Set<MenuConcern>([
  "added-sugar",
  "dairy",
  "fried",
  "gluten",
  "high-sodium",
  "processed-meat",
  "seed-oil-likely",
]);
const MENU_EVIDENCE = new Set<MenuEvidenceLevel>(["restaurant-verified", "menu-inferred", "unknown"]);

export interface MenuPageUpload {
  blob: Blob;
  filename: string;
}

export async function analyzeMenuPages({
  pages,
  restaurantName,
  endpoint = import.meta.env.VITE_MENU_ANALYSIS_ENDPOINT,
  signal,
}: {
  pages: MenuPageUpload[];
  restaurantName?: string;
  endpoint?: string;
  signal?: AbortSignal;
}): Promise<MenuAnalysis> {
  validatePages(pages);
  const analysisUrl = resolveAnalysisUrl(endpoint);
  const form = new FormData();

  pages.forEach((page, index) => {
    form.append("pages", page.blob, safeFilename(page.filename, index));
  });

  const safeRestaurantName = trimText(restaurantName, 120);
  if (safeRestaurantName) {
    form.append("restaurantName", safeRestaurantName);
  }

  const response = await fetch(analysisUrl, {
    method: "POST",
    body: form,
    credentials: isSameOrigin(analysisUrl) ? "same-origin" : "omit",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(response.status === 413 ? "These menu pages are too large to analyze." : "Menu analysis is unavailable right now.");
  }

  const responseText = await response.text();
  if (responseText.length > MENU_RESPONSE_MAX_CHARACTERS) {
    throw new Error("The menu analysis response was unexpectedly large.");
  }

  let value: unknown;
  try {
    value = JSON.parse(responseText) as unknown;
  } catch {
    throw new Error("The menu analysis response was not valid JSON.");
  }

  return parseMenuAnalysis(value, pages.length);
}

export function validatePages(pages: MenuPageUpload[]): void {
  if (pages.length === 0) {
    throw new Error("Capture at least one menu page first.");
  }
  if (pages.length > MENU_PAGE_LIMIT) {
    throw new Error(`You can analyze up to ${MENU_PAGE_LIMIT} menu pages at a time.`);
  }

  let totalBytes = 0;
  for (const page of pages) {
    if (!ALLOWED_IMAGE_TYPES.has(page.blob.type)) {
      throw new Error("Menu pages must be JPEG, PNG, or WebP images.");
    }
    if (page.blob.size <= 0 || page.blob.size > MENU_PAGE_MAX_BYTES) {
      throw new Error("Each menu page must be smaller than 8 MB.");
    }
    totalBytes += page.blob.size;
  }

  if (totalBytes > MENU_UPLOAD_MAX_BYTES) {
    throw new Error("The combined menu upload must be smaller than 24 MB.");
  }
}

export function resolveAnalysisUrl(endpoint?: string): URL {
  const trimmedEndpoint = endpoint?.trim();
  if (!trimmedEndpoint) {
    throw new Error("Menu analysis has not been configured yet.");
  }

  const origin = globalThis.location?.origin ?? "http://localhost";
  const url = new URL(trimmedEndpoint, origin);
  const isLocalDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalDevelopment)) {
    throw new Error("Menu analysis must use a secure HTTPS endpoint.");
  }

  return url;
}

function parseMenuAnalysis(value: unknown, pageCount: number): MenuAnalysis {
  if (!isRecord(value) || !Array.isArray(value.dishes)) {
    throw new Error("The menu analysis response is missing dishes.");
  }

  const dishes = value.dishes
    .slice(0, MENU_DISH_LIMIT)
    .map(toMenuDish)
    .filter((dish): dish is MenuDish => dish !== null);

  if (dishes.length === 0) {
    throw new Error("No readable menu dishes were found. Try retaking the menu in brighter light.");
  }

  return {
    id: trimText(value.id, 120) ?? createAnalysisId(),
    restaurantName: trimText(value.restaurantName, 120),
    createdAt: toIsoDate(value.createdAt),
    pageCount,
    dishes,
  };
}

function toMenuDish(value: unknown): MenuDish | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = trimText(value.id, 120);
  const name = trimText(value.name, 160);
  const category = isMenuCategory(value.category) ? value.category : null;
  if (!id || !name || !category) {
    return null;
  }

  return {
    id,
    name,
    description: trimText(value.description, 500) ?? "No menu description provided.",
    price: trimText(value.price, 40),
    category,
    preparation: toStringList(value.preparation, 12, 80),
    positives: toStringList(value.positives, 12, 120),
    concerns: Array.isArray(value.concerns)
      ? value.concerns.filter((concern): concern is MenuConcern => MENU_CONCERNS.has(concern as MenuConcern)).slice(0, 12)
      : [],
    evidence: MENU_EVIDENCE.has(value.evidence as MenuEvidenceLevel) ? (value.evidence as MenuEvidenceLevel) : "unknown",
    sourceText: trimText(value.sourceText, 800) ?? name,
  };
}

function toStringList(value: unknown, limit: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => trimText(item, maxLength)).filter((item): item is string => Boolean(item)).slice(0, limit);
}

function isMenuCategory(value: unknown): value is MenuCravingCategory {
  return typeof value === "string" && MENU_CATEGORIES.has(value as MenuCravingCategory);
}

function safeFilename(value: string, index: number): string {
  const extension = value.toLowerCase().endsWith(".png") ? ".png" : value.toLowerCase().endsWith(".webp") ? ".webp" : ".jpg";
  return `menu-page-${index + 1}${extension}`;
}

function trimText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
}

function toIsoDate(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function isSameOrigin(url: URL): boolean {
  return Boolean(globalThis.location?.origin && url.origin === globalThis.location.origin);
}

function createAnalysisId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `menu-${Date.now()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
