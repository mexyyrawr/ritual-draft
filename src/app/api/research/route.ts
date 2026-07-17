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
    {
      url: "https://docs.ritualfoundation.org/build/precompiles/llm",
      name: "LLM Precompile Docs",
    },
    {
      url: "https://docs.ritualfoundation.org/build/precompiles/overview",
      name: "Precompiles Overview",
    },
    {
      url: "https://docs.ritualfoundation.org/build/agents",
      name: "Agents Documentation",
    },
  ];

  const results: Source[] = [];
  for (const page of pages) {
    try {
      const res = await fetch(page.url, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
      if (text.length > 50) {
        results.push({ name: page.name, content: text, url: page.url });
      }
    } catch (e) {
      console.error(`Failed to fetch ${page.url}:`, e);
    }
  }

  if (results.length > 0) {
    cachedDocs = { data: results, timestamp: Date.now() };
  }
  return results;
}

async function fetchRitualGitHub(): Promise<Source[]> {
  if (cachedGithub && Date.now() - cachedGithub.timestamp < CACHE_TTL) {
    return cachedGithub.data;
  }

  try {
    const res = await fetch(
      "https://api.github.com/orgs/ritual-foundation/repos?sort=updated&per_page=5",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return [];
    const repos = await res.json();

    const repoInfo = (repos as Record<string, unknown>[])
      .map(
        (r: Record<string, unknown>) =>
          `${r.name}: ${r.description || "No description"} (stars: ${r.stargazers_count || 0})`
      )
      .join("\n");

    const result: Source[] = [
      {
        name: "Ritual GitHub Repos",
        content: repoInfo || "No repos found",
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
      .slice(0, 10)
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

// Additional: fetch from Ritual ecosystem/community
async function fetchRitualEcosystem(): Promise<Source[]> {
  try {
    // Fetch from Ritual's official GitHub org for recent activity
    const res = await fetch(
      "https://api.github.com/orgs/ritual-foundation/events?per_page=10",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return [];
    const events = await res.json();

    const activity = (events as Record<string, unknown>[])
      .slice(0, 10)
      .map((e: Record<string, unknown>) => {
        const repo = e.repo as Record<string, unknown> | undefined;
        const payload = e.payload as Record<string, unknown> | undefined;
        return `${e.type}: ${repo?.name || "unknown"} - ${payload?.description || "update"}`;
      })
      .join("\n");

    return [
      {
        name: "Ritual Recent Activity",
        content: activity || "No recent activity",
        url: "https://github.com/ritual-foundation",
      },
    ];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    // Fetch from all sources in parallel
    const [docs, github, tweets, ecosystem] = await Promise.all([
      fetchRitualDocs(),
      fetchRitualGitHub(),
      fetchRitualTweets(),
      fetchRitualEcosystem(),
    ]);

    const allSources = [...docs, ...github, ...tweets, ...ecosystem];

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
