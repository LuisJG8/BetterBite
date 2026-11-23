import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin, type PreviewServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

const HUGGING_FACE_FOOD_MODEL = "nateraw/food";
const HUGGING_FACE_WHOLE_FOOD_MODEL = "google/vit-base-patch16-224";
const FOOD_RECOGNITION_MIN_SCORE = 0.7;
const FOOD_RECOGNITION_MAX_IMAGE_BYTES = 1_500_000;
const FOOD_RECOGNITION_MAX_RESPONSE_BYTES = 64 * 1024;
const HUGGING_FACE_MODEL_URL = "https://router.huggingface.co/hf-inference/models/";

interface FoodRecognitionProxyResult {
  label: string;
  score: number;
  model: string;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.VITE_HUGGING_FACE_TOKEN?.trim()) {
    throw new Error("Rename VITE_HUGGING_FACE_TOKEN to HF_TOKEN so Vite cannot publish the provider token to browsers.");
  }

  return {
    plugins: [react(), foodRecognitionProxy(env)],
    clearScreen: false,
    server: {
      strictPort: true,
    },
    test: {
      environment: "node",
    },
  };
});

function foodRecognitionProxy(env: Record<string, string>): Plugin {
  function attach(server: ViteDevServer | PreviewServer) {
    server.middlewares.use("/api/food-recognition", async (request, response) => {
      const controller = new AbortController();
      response.once("close", () => controller.abort());
      try {
        await handleFoodRecognitionRequest(request, response, env, controller.signal);
      } catch (error) {
        if (response.destroyed) return;
        sendJson(response, 502, {
          error: error instanceof Error ? error.message : "Food recognition is unavailable.",
        });
      }
    });
  }

  return {
    name: "betterbite-food-recognition-proxy",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

async function handleFoodRecognitionRequest(
  request: IncomingMessage,
  response: ServerResponse,
  env: Record<string, string>,
  signal: AbortSignal,
): Promise<void> {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Food recognition expects POST." });
    return;
  }

  const peer = request.socket.remoteAddress;
  if (peer !== "127.0.0.1" && peer !== "::1" && peer !== "::ffff:127.0.0.1") {
    sendJson(response, 403, { error: "Food recognition requires a local preview connection." });
    return;
  }

  const origin = request.headers.origin;
  if (origin && ![`http://${request.headers.host}`, `https://${request.headers.host}`].includes(origin)) {
    sendJson(response, 403, { error: "Use the food scanner from this app." });
    return;
  }

  const token = env.HUGGING_FACE_API_TOKEN?.trim() || env.HF_TOKEN?.trim();
  if (!token) {
    sendJson(response, 401, {
      error: "Food recognition is unavailable until the service is configured.",
    });
    return;
  }

  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string" || !/^image\/(?:jpeg|png|webp)$/i.test(contentType)) {
    sendJson(response, 415, { error: "Food recognition expects a JPEG, PNG, or WebP image." });
    return;
  }

  if (Number(request.headers["content-length"]) > FOOD_RECOGNITION_MAX_IMAGE_BYTES) {
    sendJson(response, 413, { error: "Food recognition image was too large." });
    return;
  }
  const image = await readBoundedBody(request.iterator({ destroyOnReturn: false }), FOOD_RECOGNITION_MAX_IMAGE_BYTES);
  if (image === null) {
    request.resume();
    sendJson(response, 413, { error: "Food recognition image was too large." });
    return;
  }
  if (!image.length) {
    sendJson(response, 400, { error: "Food recognition needs an image." });
    return;
  }
  const primary = await classifyWithHuggingFaceModel(HUGGING_FACE_FOOD_MODEL, image, contentType, token, signal);

  if (primary.status !== 200) {
    sendJson(response, primary.status, { error: `Food recognition service returned ${primary.status}.` });
    return;
  }

  const primaryResults = normalizeFoodRecognitionPayload(primary.payload, HUGGING_FACE_FOOD_MODEL);
  if (primaryResults.some((result) => result.score >= FOOD_RECOGNITION_MIN_SCORE)) {
    sendJson(response, 200, primaryResults);
    return;
  }

  const fallback = await classifyWithHuggingFaceModel(HUGGING_FACE_WHOLE_FOOD_MODEL, image, contentType, token, signal);
  if (fallback.status !== 200) {
    sendJson(response, 200, primaryResults);
    return;
  }

  const fallbackResults = normalizeFoodRecognitionPayload(fallback.payload, HUGGING_FACE_WHOLE_FOOD_MODEL)
    .map(normalizeWholeFoodResult)
    .filter((result): result is FoodRecognitionProxyResult => result !== null);

  sendJson(response, 200, fallbackResults.length > 0 ? fallbackResults : primaryResults);
}

async function classifyWithHuggingFaceModel(
  model: string,
  image: Buffer,
  contentType: string,
  token: string,
  signal: AbortSignal,
): Promise<{ payload: unknown; status: number }> {
  const huggingFaceResponse = await fetch(`${HUGGING_FACE_MODEL_URL}${model}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": contentType,
    },
    body: new Uint8Array(image),
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    redirect: "error",
  });
  if (!huggingFaceResponse.body) throw new Error("Food recognition returned an empty response.");
  const stream = Readable.fromWeb(huggingFaceResponse.body);
  const bytes = await readBoundedBody(stream, FOOD_RECOGNITION_MAX_RESPONSE_BYTES);
  if (!bytes) throw new Error("Food recognition response was too large.");
  const body = bytes.toString("utf8");

  return {
    payload: safeJsonParse(body),
    status: huggingFaceResponse.status,
  };
}

function normalizeFoodRecognitionPayload(payload: unknown, model: string): FoodRecognitionProxyResult[] {
  const values = Array.isArray(payload) ? payload : [];
  const items = Array.isArray(values[0]) ? values[0] : values;

  return items
    .map((item) => normalizeFoodRecognitionItem(item, model))
    .filter((item): item is FoodRecognitionProxyResult => item !== null)
    .sort((left, right) => right.score - left.score);
}

function normalizeFoodRecognitionItem(value: unknown, model: string): FoodRecognitionProxyResult | null {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.score !== "number" || !Number.isFinite(value.score)) {
    return null;
  }

  const label = value.label.trim().replace(/_/g, " ");
  if (!label) {
    return null;
  }

  return {
    label,
    score: Math.min(1, Math.max(0, value.score)),
    model,
  };
}

function normalizeWholeFoodResult(result: FoodRecognitionProxyResult): FoodRecognitionProxyResult | null {
  const label = canonicalWholeFoodLabel(result.label);
  return label ? { ...result, label } : null;
}

function canonicalWholeFoodLabel(label: string): string | null {
  const lower = label.toLowerCase();
  const firstLabel = lower.split(",")[0]?.trim() ?? lower;
  const knownFoods: Record<string, string> = {
    acorn_squash: "squash",
    artichoke: "artichoke",
    banana: "banana",
    bell_pepper: "bell pepper",
    broccoli: "broccoli",
    butternut_squash: "squash",
    cabbage: "cabbage",
    cheeseburger: "cheeseburger",
    corn: "corn",
    cucumber: "cucumber",
    fig: "fig",
    granny_smith: "apple",
    hotdog: "hot dog",
    lemon: "lemon",
    orange: "orange",
    pineapple: "pineapple",
    pizza: "pizza",
    pomegranate: "pomegranate",
    pretzel: "pretzel",
    spaghetti_squash: "squash",
    strawberry: "strawberry",
    zucchini: "zucchini",
  };
  const normalized = firstLabel.replace(/\s+/g, "_");

  return Object.hasOwn(knownFoods, normalized) ? knownFoods[normalized] : null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function readBoundedBody(stream: AsyncIterable<Uint8Array>, maxBytes: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let byteLength = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;

    if (byteLength > maxBytes) {
      return null;
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks, byteLength);
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
