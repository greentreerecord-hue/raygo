import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveIndexedPage } from "@/app/lib/crawler-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RAYSSTREAM_MUSIC_API =
  "https://raysstream.com/api/music-shop";

const RAYSSTREAM_MUSIC_SHOP =
  "https://raysstream.com/music-shop";

type MusicRelease = {
  id?: number | string;
  title?: string;
  artistName?: string;
  artist_name?: string;
  genre?: string;
  priceCents?: number;
  price_cents?: number;
  reviewStatus?: string;
  review_status?: string;
  published?: boolean;
};

function secretsMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function getPrice(release: MusicRelease) {
  const priceCents =
    typeof release.priceCents === "number"
      ? release.priceCents
      : typeof release.price_cents === "number"
        ? release.price_cents
        : 0;

  return priceCents > 0
    ? `$${(priceCents / 100).toFixed(2)}`
    : "";
}

function isApproved(release: MusicRelease) {
  const status =
    cleanText(
      release.reviewStatus || release.review_status
    ).toLowerCase();

  if (status && status !== "approved") {
    return false;
  }

  if (
    typeof release.published === "boolean" &&
    !release.published
  ) {
    return false;
  }

  return true;
}

function readReleases(data: unknown): MusicRelease[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object" &&
    "songs" in data &&
    Array.isArray(
      (data as { songs?: unknown }).songs
    )
  ) {
    return (data as { songs: MusicRelease[] }).songs;
  }

  if (
    data &&
    typeof data === "object" &&
    "releases" in data &&
    Array.isArray(
      (data as { releases?: unknown }).releases
    )
  ) {
    return (
      data as { releases: MusicRelease[] }
    ).releases;
  }

  return [];
}

export async function POST(request: NextRequest) {
  try {
    const crawlerSecret =
      process.env.RAYGO_CRAWLER_SECRET;

    if (!crawlerSecret) {
      return NextResponse.json(
        {
          error:
            "Music importing is not configured.",
        },
        { status: 503 }
      );
    }

    const suppliedSecret =
      request.headers.get("x-crawler-secret") || "";

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

    const response = await fetch(
      RAYSSTREAM_MUSIC_API,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "RayGoBot/1.0 (+https://raygoes.com)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Ray'sStream returned HTTP ${response.status}.`
      );
    }

    const data: unknown = await response.json();
    const releases = readReleases(data).filter(
      isApproved
    );

    const indexed: string[] = [];
    const skipped: string[] = [];

    for (let index = 0; index < releases.length; index += 1) {
      const release = releases[index];

      const title = cleanText(release.title);
      const artist = cleanText(
        release.artistName || release.artist_name
      );
      const genre = cleanText(release.genre);
      const price = getPrice(release);

      if (!title) {
        skipped.push(
          `Release ${index + 1}: missing title`
        );
        continue;
      }

      const releaseId =
        release.id !== undefined
          ? String(release.id)
          : `${index + 1}-${encodeURIComponent(title)}`;

      const resultUrl =
        `${RAYSSTREAM_MUSIC_SHOP}` +
        `?release=${encodeURIComponent(releaseId)}`;

      const descriptionParts = [
        artist ? `Artist: ${artist}` : "",
        genre ? `Genre: ${genre}` : "",
        price ? `Price: ${price}` : "",
        "Available from the Ray'sStream Music Shop.",
      ].filter(Boolean);

      await saveIndexedPage({
        url: resultUrl,
        hostname: "raysstream.com",
        title: artist
          ? `${title} — ${artist}`
          : title,
        description: descriptionParts.join(" "),
        content: [
          title,
          artist,
          genre,
          price,
          "Ray'sStream",
          "music",
          "song",
        ]
          .filter(Boolean)
          .join(" "),
        category: "music",
      });

      indexed.push(resultUrl);
    }

    return NextResponse.json({
      success: true,
      importedCount: indexed.length,
      indexed,
      skipped,
    });
  } catch (error) {
    console.error(
      "RayGo music import error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Music import failed.";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
} 
