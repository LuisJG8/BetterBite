import { invoke } from "@tauri-apps/api/core";

export const FOOD_RECOGNITION_MODEL = "nateraw/food";
export const FOOD_RECOGNITION_FALLBACK_MODEL = "google/vit-base-patch16-224";
export const FOOD_RECOGNITION_MIN_SCORE = 0.7;

const LOCAL_FOOD_RECOGNITION_URL = "/api/food-recognition";
const FOOD_RECOGNITION_TIMEOUT_MS = 20_000;
const FOOD_RECOGNITION_MAX_RESPONSE_BYTES = 64 * 1024;

export interface FoodRecognitionResult {
  label: string;
  score: number;
  model: string;
}

interface HuggingFaceClassificationResult {
  label?: unknown;
  score?: unknown;
}

export async function recognizeFoodInImage(imageDataUrl: string): Promise<FoodRecognitionResult | null> {
  const results = isTauriRuntime()
    ? await invoke<FoodRecognitionResult[]>("classify_food_image", { imageDataUrl })
    : await classifyFoodImageInBrowser(imageDataUrl);
  const bestResult = normalizeFoodRecognitionResults(results)[0];

  return bestResult && bestResult.score >= FOOD_RECOGNITION_MIN_SCORE ? bestResult : null;
}

export function normalizeFoodRecognitionResults(value: unknown): FoodRecognitionResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeFoodRecognitionResult(item))
    .filter((item): item is FoodRecognitionResult => item !== null)
    .sort((left, right) => right.score - left.score);
}

async function classifyFoodImageInBrowser(imageDataUrl: string): Promise<FoodRecognitionResult[]> {
  const image = dataUrlToBlob(imageDataUrl);
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), FOOD_RECOGNITION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(LOCAL_FOOD_RECOGNITION_URL, {
      method: "POST",
      headers: browserFoodRecognitionHeaders(image.type),
      body: image,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Food recognition timed out.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  const payload = await readBoundedJsonResponse(response);

  if (!response.ok) {
    throw new Error(huggingFaceErrorMessage(payload, response.status));
  }

  return normalizeFoodRecognitionResults(payload);
}

function browserFoodRecognitionHeaders(contentType: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": contentType || "image/jpeg",
  };
}

async function readBoundedJsonResponse(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > FOOD_RECOGNITION_MAX_RESPONSE_BYTES) {
    throw new Error("Food recognition response was too large.");
  }

  const text = await response.text();
  if (text.length > FOOD_RECOGNITION_MAX_RESPONSE_BYTES) {
    throw new Error("Food recognition response was too large.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Could not read food recognition response.");
  }
}

function normalizeFoodRecognitionResult(value: unknown): FoodRecognitionResult | null {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.score !== "number" || !Number.isFinite(value.score)) {
    return null;
  }

  const label = value.label.trim().replace(/_/g, " ");
  if (!label) {
    return null;
  }

  return {
    label,
    score: clampScore(value.score),
    model: typeof value.model === "string" && value.model.trim() ? value.model.trim() : FOOD_RECOGNITION_MODEL,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(",", 2);
  const mimeMatch = /^data:(image\/(?:jpeg|png|webp));base64$/i.exec(header ?? "");

  if (!mimeMatch || !encoded) {
    throw new Error("Food recognition needs a captured image frame.");
  }

  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeMatch[1].toLowerCase() });
}

function huggingFaceErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  if (status === 401 || status === 403) {
    return "Food recognition needs a Hugging Face token with Inference Providers access.";
  }

  return `Food recognition returned ${status}.`;
}

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}
