import { readBoundedResponseText } from "./readBoundedResponse";
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

export async function recognizeFoodInImage(imageDataUrl: string, signal?: AbortSignal): Promise<FoodRecognitionResult | null> {
  const relay = import.meta.env.VITE_FOOD_RECOGNITION_ENDPOINT?.trim();
  const results = !relay && isTauriRuntime() && !import.meta.env.DEV
    ? await invoke<FoodRecognitionResult[]>("classify_food_image", { imageDataUrl })
    : await classifyFoodImageInBrowser(imageDataUrl, relay ? resolveFoodRelay(relay) : LOCAL_FOOD_RECOGNITION_URL, signal);
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

function resolveFoodRelay(endpoint: string): string {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Food recognition requires an absolute HTTPS relay URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Food recognition requires an HTTPS relay URL without embedded credentials.");
  }
  return url.href;
}

async function classifyFoodImageInBrowser(imageDataUrl: string, endpoint: string, signal?: AbortSignal): Promise<FoodRecognitionResult[]> {
  const image = dataUrlToBlob(imageDataUrl);
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), FOOD_RECOGNITION_TIMEOUT_MS);

  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      headers: browserFoodRecognitionHeaders(image.type),
      body: image,
      signal: controller.signal,
    });
    const payload = await readBoundedJsonResponse(response);
    if (!response.ok) throw new Error(huggingFaceErrorMessage(payload, response.status));
    return normalizeFoodRecognitionResults(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Food recognition timed out.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
}

function browserFoodRecognitionHeaders(contentType: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": contentType || "image/jpeg",
  };
}

async function readBoundedJsonResponse(response: Response): Promise<unknown> {
  const text = await readBoundedResponseText(response, FOOD_RECOGNITION_MAX_RESPONSE_BYTES, "Food recognition");

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

  const label = value.label.trim().replace(/_/g, " ").slice(0, 240);
  if (!label) {
    return null;
  }

  return {
    label,
    score: clampScore(value.score),
    model: typeof value.model === "string" && value.model.trim() ? value.model.trim().slice(0, 240) : FOOD_RECOGNITION_MODEL,
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
    return payload.error.trim().slice(0, 240);
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
