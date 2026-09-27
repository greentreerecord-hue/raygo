import { timingSafeEqual } from "crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { crawlWebsite } from "@/app/lib/crawler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretsMatch(
  received: string,
  expected: string
) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

function readUrlList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

async function runCrawler(url: string) {
  const result = await crawlWebsite(url);

  return {
    success: true,
    updateType: "website",
    url,
    indexedCount: result.indexed.length,
    indexed: result.indexed,
    skipped: result.skipped,
    errors: result.errors,
  };
}

async function runImporter(
  request: NextRequest,
  path: string,
  body: Record<string, string>,
  crawlerSecret: string
) {
  const endpoint = new URL(
    path,
    request.url
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-crawler-secret": crawlerSecret,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(50_000),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      data &&
      typeof data.error === "string"
        ? data.error
        : `Scheduled importer returned HTTP ${response.status}.`;

    throw new Error(errorMessage);
  }

  return data;
}

export async function GET(
  request: NextRequest
) {
  try {
    const cronSecret =
      process.env.CRON_SECRET;

    const crawlerSecret =
      process.env.RAYGO_CRAWLER_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        {
          error:
            "Scheduled crawling is not configured.",
        },
        { status: 503 }
      );
    }

    if (!crawlerSecret) {
      return NextResponse.json(
        {
          error:
            "Crawler administration is not configured.",
        },
        { status: 503 }
      );
    }

    const authorization =
      request.headers.get("authorization") || "";

    const suppliedSecret =
      authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";

    if (
      !secretsMatch(
        suppliedSecret,
        cronSecret
      )
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const dayNumber = Math.floor(
      Date.now() / 86_400_000
    );

    const updateType =
      dayNumber % 3;

    if (updateType === 0) {
      const urls = readUrlList(
        process.env.RAYGO_CRAWL_URLS
      );

      if (urls.length === 0) {
        return NextResponse.json(
          {
            error:
              "RAYGO_CRAWL_URLS is not configured.",
          },
          { status: 503 }
        );
      }

      const selectedUrl =
        urls[
          Math.floor(dayNumber / 3) %
            urls.length
        ];

      const result =
        await runCrawler(selectedUrl);

      return NextResponse.json(result);
    }

    if (updateType === 1) {
      const feeds = readUrlList(
        process.env.RAYGO_NEWS_FEEDS
      );

      if (feeds.length === 0) {
        return NextResponse.json(
          {
            error:
              "RAYGO_NEWS_FEEDS is not configured.",
          },
          { status: 503 }
        );
      }

      const selectedFeed =
        feeds[
          Math.floor(dayNumber / 3) %
            feeds.length
        ];

      const result =
        await runImporter(
          request,
          "/api/news/import",
          {
            feedUrl: selectedFeed,
          },
          crawlerSecret
        );

      return NextResponse.json({
        updateType: "news",
        feedUrl: selectedFeed,
        ...result,
      });
    }

    const result = await runImporter(
      request,
      "/api/music/import",
      {},
      crawlerSecret
    );

    return NextResponse.json({
      updateType: "music",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Scheduled RayGo update failed.";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const crawlerSecret =
      process.env.RAYGO_CRAWLER_SECRET;

    if (!crawlerSecret) {
      return NextResponse.json(
        {
          error:
            "Crawler administration is not configured.",
        },
        { status: 503 }
      );
    }

    const suppliedSecret =
      request.headers.get(
        "x-crawler-secret"
      ) || "";

    if (
      !secretsMatch(
        suppliedSecret,
        crawlerSecret
      )
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const url =
      typeof body?.url === "string"
        ? body.url.trim()
        : "";

    if (!url || url.length > 2_000) {
      return NextResponse.json(
        {
          error:
            "Enter a valid public website URL.",
        },
        { status: 400 }
      );
    }

    const result = await runCrawler(url);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Crawler failed.";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
} 
