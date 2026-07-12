import { afterEach, describe, expect, it, vi } from "vitest";
import { FOOD_RECOGNITION_FALLBACK_MODEL, FOOD_RECOGNITION_MODEL, normalizeFoodRecognitionResults, recognizeFoodInImage } from "./foodRecognition";

describe("foodRecognition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
        headers: {
          Accept: "application/json",
          "Content-Type": "image/jpeg",
        },
      }),
    );
  });
});
