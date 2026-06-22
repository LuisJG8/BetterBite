export const APP_TAB_ORDER = ["home", "search", "scan", "history", "profile"] as const;

export type AppTab = (typeof APP_TAB_ORDER)[number];
export type TabDirection = -1 | 1;

const SWIPE_DISTANCE_RATIO = 0.28;
const SWIPE_VELOCITY_THRESHOLD = 650;
const SWIPE_AXIS_THRESHOLD = 8;
const SWIPE_AXIS_RATIO = 1.2;

export function getAdjacentTab(tab: AppTab, direction: TabDirection): AppTab | null {
  const currentIndex = APP_TAB_ORDER.indexOf(tab);
  const nextTab = APP_TAB_ORDER[currentIndex + direction];

  return nextTab ?? null;
}

export function getTabDirection(fromTab: AppTab, toTab: AppTab): TabDirection | null {
  const fromIndex = APP_TAB_ORDER.indexOf(fromTab);
  const toIndex = APP_TAB_ORDER.indexOf(toTab);

  if (fromIndex === toIndex) {
    return null;
  }

  return toIndex > fromIndex ? 1 : -1;
}

export function getSwipeProgress({ offsetX, width }: { offsetX: number; width: number }): number {
  if (width <= 0) {
    return 0;
  }

  return Math.min(1, Math.abs(offsetX) / width);
}

export function resolveSwipeTarget({
  tab,
  offsetX,
  velocityX,
  width,
}: {
  tab: AppTab;
  offsetX: number;
  velocityX: number;
  width: number;
}): { direction: TabDirection; progress: number; shouldCommit: boolean; target: AppTab | null } {
  const direction = getSwipeDirection(offsetX, velocityX);
  const target = getAdjacentTab(tab, direction);
  const progress = getSwipeProgress({ offsetX, width });
  const hasEnoughDistance = progress >= SWIPE_DISTANCE_RATIO;
  const hasEnoughVelocity = Math.abs(velocityX) >= SWIPE_VELOCITY_THRESHOLD;

  return {
    direction,
    progress,
    shouldCommit: Boolean(target && (hasEnoughDistance || hasEnoughVelocity)),
    target,
  };
}

export function shouldStartHorizontalSwipe({ deltaX, deltaY }: { deltaX: number; deltaY: number }): boolean {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  return absX >= SWIPE_AXIS_THRESHOLD && absX >= absY * SWIPE_AXIS_RATIO;
}

function getSwipeDirection(offsetX: number, velocityX: number): TabDirection {
  const directionalValue = Math.abs(velocityX) >= SWIPE_VELOCITY_THRESHOLD ? velocityX : offsetX;

  return directionalValue < 0 ? 1 : -1;
}
