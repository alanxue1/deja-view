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

  // Color handling: strongly prefer results that match the query color(s).
  const colorTokens = new Set([
    "orange",
    "black",
    "white",
    "gray",
    "grey",
    "blue",
    "green",
    "red",
    "tan",
    "beige",
    "brown",
    "cream",
    "ivory",
    "navy",
    "pink",
    "purple",
    "yellow",
    "gold",
    "silver",
  ]);
  const queryColors = q.filter((t) => colorTokens.has(t));
  const resultColors = Array.from(colorTokens).filter((c) => haystack.includes(c));

  const hasQueryColorMatch = queryColors.length === 0 ? true : queryColors.some((c) => haystack.includes(c));
  const missingColorPenalty = queryColors.length > 0 && !hasQueryColorMatch ? 0.35 : 0;

  // Penalize obvious conflicting colors (e.g. query says black, title says red).
  const conflictingPenalty =
    queryColors.length > 0
      ? resultColors.some((c) => !queryColors.includes(c)) && !hasQueryColorMatch
        ? 0.2
        : 0
      : 0;

  // Small boost for exact color match appearances.
  const colorBoost = queryColors.reduce((acc, c) => (haystack.includes(c) ? acc + 0.12 : acc), 0);

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

  return Math.max(0, hits / q.length + colorBoost - penalty - missingColorPenalty - conflictingPenalty);
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

