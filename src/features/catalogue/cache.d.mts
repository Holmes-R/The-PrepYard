export type CatalogueCache = {
  clear(): void;
  read<T>(key: string, loader: () => Promise<T>): Promise<T>;
};
export function createCatalogueCache(options?: {
  ttlMs?: number;
  capacity?: number;
  now?: () => number;
  onEvent?: (event: "hit" | "miss" | "wait") => void;
}): CatalogueCache;
