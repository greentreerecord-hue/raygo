import { NextRequest, NextResponse } from "next/server";
import { searchIndexedPages } from "@/app/lib/crawler-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query =
      request.nextUrl.searchParams.get("q")?.trim() || "";

    if (!query) {
      return NextResponse.json({
        query: "",
        results: [],
      });
    }

    if (query.length > 200) {
      return NextResponse.json(
        { error: "Search text is too long." },
        { status: 400 }
      );
    }

    const results = await searchIndexedPages(query);

    return NextResponse.json({
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("RayGo search error:", error);

    return NextResponse.json(
      { error: "RayGo search is temporarily unavailable." },
      { status: 500 }
    );
  }
} 
