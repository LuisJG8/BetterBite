import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeMenuPages, resolveAnalysisUrl, validatePages } from "./menuAnalysisApi";

const page = { blob: new Blob(["menu"], { type: "image/jpeg" }), filename: "original name.jpg" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("menu analysis client", () => {
  it("rejects insecure remote endpoints", () => {
    expect(() => resolveAnalysisUrl("http://example.com/analyze")).toThrow(/HTTPS/);
    expect(resolveAnalysisUrl("https://example.com/analyze").href).toBe("https://example.com/analyze");
  });

  it("bounds page count, type, and size before making a request", () => {
    expect(() => validatePages([])).toThrow(/at least one/);
    expect(() => validatePages([{ blob: new Blob(["text"], { type: "text/plain" }), filename: "menu.txt" }])).toThrow(/JPEG/);
    expect(() => validatePages(Array.from({ length: 7 }, () => page))).toThrow(/up to 6/);
  });

  it("sanitizes the response and uses safe generated filenames", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "analysis-1",
          restaurantName: " Test Kitchen ",
          createdAt: "2026-08-20T12:00:00.000Z",
          dishes: [
            {
              id: "burger-1",
              name: " Single Burger ",
              description: "One patty",
              price: "$8",
              category: "burgers",
              preparation: ["griddled"],
              positives: ["single patty"],
              concerns: ["high-sodium", "not-a-real-concern"],
              evidence: "menu-inferred",
              sourceText: "Single Burger $8",
            },
            { id: "bad-dish", name: "Missing category" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeMenuPages({ pages: [page], endpoint: "https://api.example.com/menu" });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const form = request.body as FormData;

    expect(result.restaurantName).toBe("Test Kitchen");
    expect(result.dishes).toHaveLength(1);
    expect(result.dishes[0].concerns).toEqual(["high-sodium"]);
    expect((form.get("pages") as File).name).toBe("menu-page-1.jpg");
    expect(request.credentials).toBe("omit");
  });

  it("does not expose server error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("internal stack trace", { status: 500 })));

    await expect(analyzeMenuPages({ pages: [page], endpoint: "https://api.example.com/menu" })).rejects.toThrow(
      "Menu analysis is unavailable right now.",
    );
  });
});
