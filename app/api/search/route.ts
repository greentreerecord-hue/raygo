import {
  getLatestCategoryPages,
  searchIndexedPages,
} from "@/app/lib/crawler-db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedCategories = new Set([
  "web",
  "news",
  "images",
  "videos",
  "music",
]);

export async function GET(request: NextRequest) {
  try {
    const query =
      request.nextUrl.searchParams.get("q")?.trim() || "";

    const category =
      request.nextUrl.searchParams
        .get("category")
        ?.trim()
        .toLowerCase() || "";

    if (
      category &&
      !allowedCategories.has(category)
    ) {
      return NextResponse.json(
        { error: "Invalid search category." },
        { status: 400 }
      );
    }

    if (query.length > 200) {
      return NextResponse.json(
        { error: "Search text is too long." },
        { status: 400 }
      );
    }

    if (!query && !category) {
      return NextResponse.json({
        query: "",
        category: "",
        count: 0,
        results: [],
      });
    }

    const results = query
      ? await searchIndexedPages(
          query,
          category || undefined
        )
      : await getLatestCategoryPages(category);

    return NextResponse.json({
      query,
      category,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("RayGo search error:", error);

    return NextResponse.json(
      {
        error:
          "RayGo search is temporarily unavailable.",
      },
      { status: 500 }
    );
  }
} 
