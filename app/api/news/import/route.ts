import * as cheerio from "cheerio";
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveIndexedPage } from "@/app/lib/crawler-db";
import { fetchPublicPage } from "@/app/lib/crawler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FEED_BYTES = 2_000_000;
const MAX_ARTICLES = 25;

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

function cleanText(value: string) {
  if (!value) {
    return "";
  }

  const $ = cheerio.load(value);

  return $.root()
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function parsePublishedDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getArticleUrl(
  rawUrl: string,
  feedUrl: string
) {
  const articleUrl = new URL(
    rawUrl,
    feedUrl
  );

  if (
    articleUrl.protocol !== "https:" &&
    articleUrl.protocol !== "http:"
  ) {
    throw new Error(
      "News article URL is not public HTTP or HTTPS."
    );
  }

  articleUrl.hash = "";

  return articleUrl;
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

    const feedUrl =
      typeof body?.feedUrl === "string"
        ? body.feedUrl.trim()
        : "";

    if (
      !feedUrl ||
      feedUrl.length > 2_000
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid public RSS or Atom feed URL.",
        },
        { status: 400 }
      );
    }

    const response =
      await fetchPublicPage(feedUrl);

    if (!response.ok) {
      throw new Error(
        `News feed returned HTTP ${response.status}.`
      );
    }

    const contentLength = Number(
      response.headers.get(
        "content-length"
      ) || "0"
    );

    if (
      contentLength > MAX_FEED_BYTES
    ) {
      throw new Error(
        "The news feed is too large."
      );
    }

    const xml = await response.text();

    if (
      Buffer.byteLength(
        xml,
        "utf8"
      ) > MAX_FEED_BYTES
    ) {
      throw new Error(
        "The news feed is too large."
      );
    }

    const $ = cheerio.load(xml, {
      xmlMode: true,
    });

    const imported: string[] = [];
    const skipped: string[] = [];

    const rssItems = $("item").toArray();
    const atomEntries = $("entry").toArray();

    const entries =
      rssItems.length > 0
        ? rssItems
        : atomEntries;

    if (entries.length === 0) {
      throw new Error(
        "No news articles were found in this feed."
      );
    }

    for (
      const entry of entries.slice(
        0,
        MAX_ARTICLES
      )
    ) {
      try {
        const element = $(entry);

        const isAtom =
          atomEntries.length > 0 &&
          rssItems.length === 0;

        const title = cleanText(
          element
            .find("title")
            .first()
            .text()
        );

        const rawUrl = isAtom
          ? element
              .find(
                'link[rel="alternate"], link:not([rel])'
              )
              .first()
              .attr("href") || ""
          : element
              .find("link")
              .first()
              .text()
              .trim();

        const description = cleanText(
          isAtom
            ? element
                .find(
                  "summary, content"
                )
                .first()
                .text()
            : element
                .find(
                  "description, content\\:encoded"
                )
                .first()
                .text()
        );

        const publishedValue = isAtom
          ? element
              .find(
                "published, updated"
              )
              .first()
              .text()
              .trim()
          : element
              .find("pubDate")
              .first()
              .text()
              .trim();

        if (!title || !rawUrl) {
          skipped.push(
            title || "Untitled article"
          );
          continue;
        }

        const articleUrl =
          getArticleUrl(
            rawUrl,
            feedUrl
          );

        await saveIndexedPage({
          url: articleUrl.toString(),
          hostname:
            articleUrl.hostname,
          title: title.slice(0, 500),
          description:
            description.slice(0, 1_000),
          content: `${title} ${description}`.slice(
            0,
            100_000
          ),
          category: "news",
          publishedAt:
            parsePublishedDate(
              publishedValue
            ),
        });

        imported.push(
          articleUrl.toString()
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Invalid article";

        skipped.push(message);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount: imported.length,
      imported,
      skipped,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "News import failed.";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
} 
