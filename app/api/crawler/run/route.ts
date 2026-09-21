import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { crawlWebsite } from "@/app/lib/crawler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretsMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const crawlerSecret = process.env.RAYGO_CRAWLER_SECRET;

    if (!crawlerSecret) {
      return NextResponse.json(
        { error: "Crawler administration is not configured." },
        { status: 503 }
      );
    }

    const suppliedSecret =
      request.headers.get("x-crawler-secret") || "";

    if (!secretsMatch(suppliedSecret, crawlerSecret)) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const url =
      typeof body?.url === "string" ? body.url.trim() : "";

    if (!url || url.length > 2_000) {
      return NextResponse.json(
        { error: "Enter a valid public website URL." },
        { status: 400 }
      );
    }

    const result = await crawlWebsite(url);

    return NextResponse.json({
      success: true,
      indexedCount: result.indexed.length,
      indexed: result.indexed,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Crawler failed.";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
} 
