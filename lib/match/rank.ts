import type { NormalizedProduct } from "./types";
import { tokenize } from "./tokenize";

export function scoreProductAgainstQuery(args: {
  query: string;
  title: string;
  vendor?: string;
}): number {
  const q = tokenize(args.query);
  if (q.length === 0) return 0;

  const haystack = `${args.title} ${args.vendor ?? ""}`.toLowerCase();
  let hits = 0;
  for (const t of q) {
    if (haystack.includes(t)) hits += 1;
  }

  // Mild per-token boost *only if that color appears in the result text*.
  const colorTokens = new Set(["orange", "black", "white", "gray", "grey", "blue", "green", "red", "tan", "beige"]);
  const colorBoost = q.reduce((acc, t) => (colorTokens.has(t) && haystack.includes(t) ? acc + 0.08 : acc), 0);

  // Penalize clearly irrelevant “content” results that happen to include the keywords.
  const badTokens = [
    "video",
    "youtube",
    "tiktok",
    "reel",
    "pinterest",
    "tutorial",
    "how",
    "make",
    "build",
    "diy",
    "woodworking",
    "plans",
    "press",
    "blog",
  ];
  const penalty = badTokens.reduce((acc, t) => (haystack.includes(t) ? acc + 0.6 : acc), 0);

  return Math.max(0, hits / q.length + colorBoost - penalty);
}

export function rankAndTrim(args: {
  query: string;
  products: NormalizedProduct[];
  limit: number;
}): NormalizedProduct[] {
  const scored = args.products.map((p) => ({
    p: { ...p, score: scoreProductAgainstQuery({ query: args.query, title: p.title, vendor: p.vendor }) },
  }));
  scored.sort((a, b) => b.p.score - a.p.score);
  return scored.slice(0, args.limit).map((x) => x.p);
}

