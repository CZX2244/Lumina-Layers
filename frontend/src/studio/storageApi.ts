/** Storage overview / selective cleanup API (Lumina Studio Plus backend route). */
import apiClient from "../api/client";

export type StorageCategoryId = "temp" | "models" | "solver_cache" | "feedback" | "logs";

export interface StorageEntry {
  id: StorageCategoryId;
  path: string;
  bytes: number;
  files: number;
  exists: boolean;
}

export async function getStorageOverview(): Promise<{ categories: StorageEntry[]; total_bytes: number }> {
  const response = await apiClient.get("/system/storage");
  return response.data;
}

export async function cleanStorage(categories: StorageCategoryId[]): Promise<{ deleted_files: number; freed_bytes: number; failed_files: number }> {
  const response = await apiClient.post("/system/storage/clean", { categories });
  return response.data;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}
