import { describe, expect, it } from "vitest";
import type { ScanHistoryItem } from "../types";
import { filterHistoryItems } from "./historyFilters";

const history: ScanHistoryItem[] = [
  {
    barcode: "11111111",
    productName: "High score snack",
    score: 9,
    scannedAt: "2026-06-11T15:00:00.000Z",
  },
  {
    barcode: "22222222",
    productName: "Older flagged snack",
    score: 4,
    scannedAt: "2026-06-01T15:00:00.000Z",
  },
];

describe("history filters", () => {
  it("keeps existing all, saved, and this-week scan filters unchanged", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");

    expect(filterHistoryItems(history, "all", now)).toEqual(history);
    expect(filterHistoryItems(history, "saved", now).map((item) => item.barcode)).toEqual(["11111111"]);
    expect(filterHistoryItems(history, "this-week", now).map((item) => item.barcode)).toEqual(["11111111"]);
  });

  it("returns no normal scan rows for the swaps filter", () => {
    expect(filterHistoryItems(history, "swaps", new Date("2026-06-12T12:00:00.000Z"))).toEqual([]);
  });
});
