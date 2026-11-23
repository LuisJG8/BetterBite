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

const MENU_RESPONSE_MAX_BYTES = 1_000_000;
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
    form.append("pages", page.blob, safeFilename(page.blob.type, index));
  });

  const safeRestaurantName = trimText(restaurantName, 120);
  if (safeRestaurantName) {
    form.append("restaurantName", safeRestaurantName);
  }

  const response = await fetch(analysisUrl, {
    method: "POST",
    body: form,
    credentials: isSameOrigin(analysisUrl) ? "same-origin" : "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    throw new Error(response.status === 413 ? "These menu pages are too large to analyze." : "Menu analysis is unavailable right now.");
  }

  const responseText = await readMenuResponse(response);

  let value: unknown;
  try {
    value = JSON.parse(responseText) as unknown;
  } catch {
    throw new Error("The menu analysis response was not valid JSON.");
  }

  return parseMenuAnalysis(value, pages.length);
}

async function readMenuResponse(response: Response): Promise<string> {
  const tooLarge = "The menu analysis response was unexpectedly large.";
  if (Number(response.headers.get("Content-Length")) > MENU_RESPONSE_MAX_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw new Error(tooLarge);
  }
  const reader = response.body?.getReader();
  if (!reader) return "";

  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MENU_RESPONSE_MAX_BYTES) {
        void reader.cancel().catch(() => {});
        throw new Error(tooLarge);
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
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
  if (url.username || url.password) {
    throw new Error("Menu analysis endpoints cannot include credentials.");
  }
  const isLocalDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalDevelopment)) {
    throw new Error("Menu analysis must use a secure HTTPS endpoint.");
  }

  return url;
}

function parseMenuAnalysis(value: unknown, pageCount: number): MenuAnalysis {
  if (!isRecord(value) || !Array.isArray(value.dishes)) {
    throw new Error("The menu analysis response is missing dishes.");
  }

  const dishes: MenuDish[] = [];
  const ids = new Set<string>();
  for (const entry of value.dishes.slice(0, MENU_DISH_LIMIT)) {
    const dish = toMenuDish(entry);
    if (dish && !ids.has(dish.id)) {
      ids.add(dish.id);
      dishes.push(dish);
    }
  }

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
      ? [...new Set(value.concerns.filter((concern): concern is MenuConcern => MENU_CONCERNS.has(concern as MenuConcern)))]
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

function safeFilename(mimeType: string, index: number): string {
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
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
