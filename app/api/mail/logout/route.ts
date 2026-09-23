import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import postgres from "postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDatabase() {
  const connectionString =
    process.env.RAYGO_MAIL_DB_DATABASE_URL;

  if (
    !connectionString ||
    (!connectionString.startsWith("postgres://") &&
      !connectionString.startsWith("postgresql://"))
  ) {
    return null;
  }

  return postgres(connectionString, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
}

export async function POST() {
  try {
    const cookieStore = await cookies();

    const sessionToken = cookieStore.get(
      "raygo_mail_session"
    )?.value;

    const sql = getDatabase();

    if (sql) {
      try {
        if (sessionToken) {
          const tokenHash = createHash("sha256")
            .update(sessionToken)
            .digest("hex");

          await sql`
            DELETE FROM raygo_mail_sessions
            WHERE token_hash = ${tokenHash}
          `;
        }
      } finally {
        await sql.end();
      }
    }

    const response = NextResponse.json({
      message: "You have been signed out.",
    });

    response.cookies.delete(
      "raygo_mail_session"
    );

    return response;
  } catch (error) {
    console.error(
      "RayGo Mail logout error:",
      error
    );

    const response = NextResponse.json({
      message: "You have been signed out.",
    });

    response.cookies.delete(
      "raygo_mail_session"
    );

    return response;
  }
} 
