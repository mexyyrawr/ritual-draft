import { NextRequest, NextResponse } from "next/server";

interface Source {
  name: string;
  content: string;
  url: string;
}

// Simple in-memory cache
let cachedDocs: { data: Source[]; timestamp: number } | null = null;
let cachedGithub: { data: Source[]; timestamp: number } | null = null;
let cachedTweets: { data: Source[]; timestamp: number } | null = null;

const CACHE_TTL = 3600 * 1000; // 1 hour

async function fetchRitualDocs(): Promise<Source[]> {
  if (cachedDocs && Date.now() - cachedDocs.timestamp < CACHE_TTL) {
    return cachedDocs.data;
  }

  const pages = [
    { url: "https://docs.ritualfoundation.org", name: "Ritual Docs Home" },
    {
      url: "https://docs.ritualfoundation.org/build/overview",
      name: "Build Overview",
    },
  ];

  const results: Source[] = [];
  for (const page of pages) {
    try {
      const res = await fetch(page.url, {
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
      results.push({ name: page.name, content: text, url: page.url });
    } catch (e) {
      console.error(`Failed to fetch ${page.url}:`, e);
    }
  }

  cachedDocs = { data: results, timestamp: Date.now() };
  return results;
}

async function fetchRitualGitHub(): Promise<Source[]> {
  if (cachedGithub && Date.now() - cachedGithub.timestamp < CACHE_TTL) {
    return cachedGithub.data;
  }

  try {
    const res = await fetch(
      "https://api.github.com/repos/ritual-foundation/events?per_page=10",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return [];
    const events = await res.json();
    const content = (events as Record<string, unknown>[])
      .filter(
        (e: Record<string, unknown>) =>
          e.type === "PushEvent" ||
          e.type === "CreateEvent" ||
          e.type === "ReleaseEvent"
      )
      .map((e: Record<string, unknown>) => {
        const payload = e.payload as Record<string, unknown> | undefined;
        const repo = e.repo as Record<string, unknown> | undefined;
        return `${e.type}: ${repo?.name || "unknown"} - ${payload?.description || payload?.release || "update"}`;
      })
      .join("\n");

    const result: Source[] = [
      {
        name: "GitHub Activity",
        content: content || "No recent activity",
        url: "https://github.com/ritual-foundation",
      },
    ];
    cachedGithub = { data: result, timestamp: Date.now() };
    return result;
  } catch {
    return [];
  }
}

async function fetchRitualTweets(): Promise<Source[]> {
  if (cachedTweets && Date.now() - cachedTweets.timestamp < CACHE_TTL) {
    return cachedTweets.data;
  }

  try {
    const res = await fetch(
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/ritual",
      { signal: AbortSignal.timeout(10000) }
    );
    const html = await res.text();

    const tweetRegex =
      /<p[^>]*class="[^"]*timeline-Tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
    const tweetMatches: string[] = [];
    let match;
    while ((match = tweetRegex.exec(html)) !== null) {
      tweetMatches.push(match[1]);
    }

    const tweets = tweetMatches
      .slice(0, 5)
      .map((m: string) => m.replace(/<[^>]*>/g, "").trim())
      .filter((t: string) => t.length > 0)
      .join("\n\n");

    const result: Source[] = [
      {
        name: "@ritual on X",
        content: tweets || "No recent tweets found",
        url: "https://x.com/ritual",
      },
    ];
    cachedTweets = { data: result, timestamp: Date.now() };
    return result;
  } catch {
    return [
      {
        name: "@ritual on X",
        content: "Could not fetch tweets",
        url: "https://x.com/ritual",
      },
    ];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    // Fetch from all sources in parallel
    const [docs, github, tweets] = await Promise.all([
      fetchRitualDocs(),
      fetchRitualGitHub(),
      fetchRitualTweets(),
    ]);

    const allSources = [...docs, ...github, ...tweets];

    // Build context string for LLM
    const context = allSources
      .filter((s) => s.content && s.content.length > 10)
      .map((s) => `[Source: ${s.name}]\n${s.content}\n`)
      .join("\n---\n");

    return NextResponse.json({
      sources: allSources,
      context,
      query,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
