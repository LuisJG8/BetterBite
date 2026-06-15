import type { HistoryFilter, ScanHistoryItem } from "../types";

export function filterHistoryItems(history: ScanHistoryItem[], filter: HistoryFilter, now = new Date()): ScanHistoryItem[] {
  if (filter === "saved") {
    return history.filter((item) => item.score >= 8);
  }

  if (filter === "this-week") {
    return history.filter((item) => isWithinCurrentWeek(item.scannedAt, now));
  }

  if (filter === "swaps") {
    return [];
  }

  return history;
}

function isWithinCurrentWeek(value: string, now: Date): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const start = new Date(now);
  const day = now.getDay();
  start.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  start.setHours(0, 0, 0, 0);

  return date >= start;
}
