import { invoke } from "@tauri-apps/api/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FOOD_RECOGNITION_FALLBACK_MODEL, FOOD_RECOGNITION_MODEL, normalizeFoodRecognitionResults, recognizeFoodInImage } from "./foodRecognition";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("foodRecognition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("normalizes Hugging Face labels and sorts by confidence", () => {
    const results = normalizeFoodRecognitionResults([
      { label: "pizza", score: 0.73 },
      { label: "french_fries", score: 0.91 },
      { label: "", score: 0.99 },
      { label: "not-score", score: "high" },
    ]);

    expect(results).toEqual([
      { label: "french fries", score: 0.91, model: FOOD_RECOGNITION_MODEL },
      { label: "pizza", score: 0.73, model: FOOD_RECOGNITION_MODEL },
    ]);
  });

  it("drops unexpected response shapes", () => {
    expect(normalizeFoodRecognitionResults({ label: "pizza", score: 0.9 })).toEqual([]);
  });

  it("preserves the model that produced a fallback whole-food result", () => {
    expect(normalizeFoodRecognitionResults([{ label: "banana", score: 0.99, model: FOOD_RECOGNITION_FALLBACK_MODEL }])).toEqual([
      { label: "banana", score: 0.99, model: FOOD_RECOGNITION_FALLBACK_MODEL },
    ]);
  });

  it("rejects an oversized streamed response without a declared length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(64 * 1024 + 1)) },
      cancel,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream));

    await expect(recognizeFoodInImage("data:image/jpeg;base64,aGVsbG8=")).rejects.toThrow("too large");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("sends release frames to a configured HTTPS relay without credentials", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_FOOD_RECOGNITION_ENDPOINT", "https://food.example.test/recognize");
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([{ label: "banana", score: 0.98 }]));

    await expect(recognizeFoodInImage("data:image/jpeg;base64,aGVsbG8=")).resolves.toMatchObject({ label: "banana" });

    expect(invoke).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith("https://food.example.test/recognize", expect.objectContaining({
      method: "POST", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
      body: expect.any(Blob), headers: { Accept: "application/json", "Content-Type": "image/jpeg" },
    }));
  });

  it.each(["http://food.example.test/recognize", "https://user:secret@food.example.test", "/relative"])(
    "rejects an invalid relay before sending any frames (%s)", async (endpoint) => {
      vi.stubEnv("VITE_FOOD_RECOGNITION_ENDPOINT", endpoint);
      const request = vi.spyOn(globalThis, "fetch");
      await expect(recognizeFoodInImage("data:image/jpeg;base64,aGVsbG8=")).rejects.toThrow("HTTPS relay URL");
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("uses the native classifier for an unconfigured packaged app", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_FOOD_RECOGNITION_ENDPOINT", "");
    vi.mocked(invoke).mockResolvedValue([{ label: "banana", score: 0.98 }]);
    const frame = "data:image/jpeg;base64,aGVsbG8=";
    await expect(recognizeFoodInImage(frame)).resolves.toMatchObject({ label: "banana" });
    expect(invoke).toHaveBeenCalledWith("classify_food_image", { imageDataUrl: frame });
  });

  it("uses the local recognition proxy in browser preview mode", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ label: "french_fries", score: 0.94 }]), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    const result = await recognizeFoodInImage("data:image/jpeg;base64,aGVsbG8=");

    expect(result).toEqual({ label: "french fries", score: 0.94, model: FOOD_RECOGNITION_MODEL });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/food-recognition",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: {
          Accept: "application/json",
          "Content-Type": "image/jpeg",
        },
      }),
    );
  });
});
