"use client";

import React from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Text from "@/components/ui/Text";
import NavBar from "@/components/layout/NavBar";
import type { MatchResponse } from "@/lib/match/types";

type UiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; data: MatchResponse };

export default function MatchTestPage() {
  const [query, setQuery] = React.useState("orange chair");
  const [state, setState] = React.useState<UiState>({ kind: "idle" });
  const [showDebug, setShowDebug] = React.useState(false);

  const formatPrice = React.useCallback(
    (p: MatchResponse["products"][number]) => {
      const min = p.priceRange?.min;
      const max = p.priceRange?.max;
      const prefix = p.currency ? `${p.currency} ` : "";
      if (!min && !max) return "Price: unknown";
      if (min && max && min === max) return `Price: ${prefix}${min}`;
      if (min && max) return `Price: ${prefix}${min}–${max}`;
      return `Price: ${prefix}${min ?? max ?? "?"}`;
    },
    []
  );

  const run = React.useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;

      setState({ kind: "loading" });
      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`match failed (${res.status}): ${text || res.statusText}`);
        }

        const data = (await res.json()) as MatchResponse;
        setState({ kind: "success", data });
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "unknown error",
        });
      }
    },
    [setState]
  );

  React.useEffect(() => {
    void run(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const products = state.kind === "success" ? state.data.products : [];
  const warnings = state.kind === "success" ? state.data.warnings ?? [] : [];

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col">
      <NavBar />

      <Container className="py-8 flex-1 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--ink)] font-normal">
            Shopify matching spike
          </h1>
          <Text className="text-sm text-[var(--ink)] opacity-70">
            Type a query, fetch from <code className="font-mono">/api/match</code>, swipe results.
          </Text>
        </div>

        <Card className="bg-white/40 border border-black/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run(query);
              }}
              placeholder="orange chair"
              className="flex-1 rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/20"
            />
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => void run(query)} disabled={state.kind === "loading"}>
                {state.kind === "loading" ? "Searching…" : "Search"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("orange chair");
                  void run("orange chair");
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-[var(--ink)] opacity-70">
            {state.kind === "idle" && "Idle"}
            {state.kind === "loading" && "Loading…"}
            {state.kind === "error" && `Error: ${state.message}`}
            {state.kind === "success" &&
              `Returned ${state.data.returned}/${state.data.totalCandidates} candidates`}
            </div>

            {state.kind === "success" ? (
              <label className="flex items-center gap-2 text-xs text-[var(--ink)] opacity-70 select-none">
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={(e) => setShowDebug(e.target.checked)}
                  className="accent-black/70"
                />
                Show debug {warnings.length ? `(${warnings.length})` : ""}
              </label>
            ) : null}
          </div>
        </Card>

        <section className="flex-1 min-h-0">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-serif text-[var(--ink)] font-normal">Results</h2>
            <Text className="text-xs text-[var(--ink)] opacity-70">
              Horizontal scroll-snap (mobile swipe)
            </Text>
          </div>

          <div className="overflow-x-auto pb-2 -mx-2 px-2">
            <div className="flex gap-4 snap-x snap-mandatory">
              {products.map((p) => (
                <a
                  key={p.id}
                  href={p.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="snap-start shrink-0 w-[78vw] sm:w-[380px]"
                >
                  <Card className="h-full bg-white/60 border border-black/10 rounded-2xl overflow-hidden">
                    <div className="aspect-[4/3] bg-black/5">
                      {p.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.images[0]}
                          alt={p.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[var(--ink)] opacity-60">
                          no image
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col gap-2">
                      <div className="text-sm text-[var(--ink)] leading-snug">
                        {p.title}
                      </div>
                      <div className="text-xs text-[var(--ink)] opacity-70">
                        {p.vendor ? `${p.vendor} · ` : ""}
                        {p.storeDomain}
                      </div>
                      <div className="text-xs text-[var(--ink)] opacity-70">
                        {formatPrice(p)}
                      </div>
                      <div className="text-[10px] text-[var(--ink)] opacity-50">
                        score {p.score.toFixed(2)}
                      </div>
                    </div>
                  </Card>
                </a>
              ))}
              {state.kind === "success" && products.length === 0 && (
                <Card className="snap-start shrink-0 w-[78vw] sm:w-[380px] bg-white/60 border border-black/10 rounded-2xl p-6">
                  <div className="text-sm text-[var(--ink)]">No results (all seeds failed).</div>
                  {state.data.warnings?.length ? (
                    <pre className="mt-3 text-[10px] whitespace-pre-wrap opacity-70">
                      {state.data.warnings.join("\n")}
                    </pre>
                  ) : null}
                </Card>
              )}
            </div>
          </div>

          {state.kind === "success" && showDebug && warnings.length ? (
            <Card className="mt-6 bg-white/40 border border-black/10 rounded-2xl p-4">
              <div className="text-xs text-[var(--ink)] opacity-70 mb-2">Warnings</div>
              <pre className="text-[10px] whitespace-pre-wrap text-[var(--ink)] opacity-70">
                {warnings.join("\n")}
              </pre>
            </Card>
          ) : null}
        </section>
      </Container>
    </main>
  );
}

