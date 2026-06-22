import { describe, expect, it } from "vitest";
import {
  APP_TAB_ORDER,
  getAdjacentTab,
  getSwipeProgress,
  getTabDirection,
  resolveSwipeTarget,
  shouldStartHorizontalSwipe,
} from "./tabNavigation";

describe("tab navigation helpers", () => {
  it("keeps the bottom navigation order", () => {
    expect(APP_TAB_ORDER).toEqual(["home", "search", "scan", "history", "profile"]);
  });

  it("finds adjacent tabs without wrapping", () => {
    expect(getAdjacentTab("home", 1)).toBe("search");
    expect(getAdjacentTab("scan", 1)).toBe("history");
    expect(getAdjacentTab("scan", -1)).toBe("search");
    expect(getAdjacentTab("home", -1)).toBeNull();
    expect(getAdjacentTab("profile", 1)).toBeNull();
  });

  it("reports tab direction from bottom-nav order", () => {
    expect(getTabDirection("home", "profile")).toBe(1);
    expect(getTabDirection("history", "search")).toBe(-1);
    expect(getTabDirection("scan", "scan")).toBeNull();
  });

  it("normalizes swipe progress by width", () => {
    expect(getSwipeProgress({ offsetX: -86, width: 430 })).toBeCloseTo(0.2);
    expect(getSwipeProgress({ offsetX: 900, width: 430 })).toBe(1);
    expect(getSwipeProgress({ offsetX: 90, width: 0 })).toBe(0);
  });

  it("commits a swipe when distance crosses the threshold", () => {
    expect(resolveSwipeTarget({ tab: "home", offsetX: -130, velocityX: 0, width: 430 })).toEqual({
      direction: 1,
      progress: 130 / 430,
      shouldCommit: true,
      target: "search",
    });
  });

  it("commits a short swipe with enough velocity", () => {
    expect(resolveSwipeTarget({ tab: "history", offsetX: 30, velocityX: 720, width: 430 })).toMatchObject({
      direction: -1,
      shouldCommit: true,
      target: "scan",
    });
  });

  it("snaps back below distance and velocity thresholds", () => {
    expect(resolveSwipeTarget({ tab: "search", offsetX: -40, velocityX: -120, width: 430 })).toMatchObject({
      direction: 1,
      shouldCommit: false,
      target: "scan",
    });
  });

  it("does not commit past the first or last tab", () => {
    expect(resolveSwipeTarget({ tab: "home", offsetX: 180, velocityX: 0, width: 430 })).toMatchObject({
      direction: -1,
      shouldCommit: false,
      target: null,
    });
    expect(resolveSwipeTarget({ tab: "profile", offsetX: -180, velocityX: 0, width: 430 })).toMatchObject({
      direction: 1,
      shouldCommit: false,
      target: null,
    });
  });

  it("starts only on a clear horizontal gesture", () => {
    expect(shouldStartHorizontalSwipe({ deltaX: 14, deltaY: 4 })).toBe(true);
    expect(shouldStartHorizontalSwipe({ deltaX: 6, deltaY: 1 })).toBe(false);
    expect(shouldStartHorizontalSwipe({ deltaX: 10, deltaY: 16 })).toBe(false);
  });
});
