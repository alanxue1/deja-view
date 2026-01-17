export type GoogleCseResult = {
  link: string;
  title?: string;
  snippet?: string;
  displayLink?: string;
};

export async function googleCseSearch(args: {
  query: string;
  apiKey: string;
  cseId: string;
  num?: number; // max 10 per request
  start?: number; // 1-indexed
}): Promise<GoogleCseResult[]> {
  const num = Math.max(1, Math.min(10, args.num ?? 10));
  const start = Math.max(1, args.start ?? 1);

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", args.apiKey);
  url.searchParams.set("cx", args.cseId);
  url.searchParams.set("q", args.query);
  url.searchParams.set("num", String(num));
  url.searchParams.set("start", String(start));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`google cse failed (${res.status}): ${text || res.statusText}`);
  }

  const json = (await res.json()) as any;
  const items = Array.isArray(json?.items) ? json.items : [];
  return items
    .map((it: any) => ({
      link: typeof it?.link === "string" ? it.link : "",
      title: typeof it?.title === "string" ? it.title : undefined,
      snippet: typeof it?.snippet === "string" ? it.snippet : undefined,
      displayLink: typeof it?.displayLink === "string" ? it.displayLink : undefined,
    }))
    .filter((x) => x.link);
}

