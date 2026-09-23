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
    throw new Error(
      "RayGo Mail database is not connected."
    );
  }

  return postgres(connectionString, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const sessionToken = cookieStore.get(
      "raygo_mail_session"
    )?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(sessionToken)
      .digest("hex");

    const sql = getDatabase();

    try {
      const users = await sql`
        SELECT
          users.id,
          users.name,
          users.username,
          users.email
        FROM raygo_mail_sessions AS sessions
        JOIN raygo_mail_users AS users
          ON users.id = sessions.user_id
        WHERE sessions.token_hash = ${tokenHash}
          AND sessions.expires_at > NOW()
        LIMIT 1
      `;

      if (users.length === 0) {
        const response = NextResponse.json(
          {
            error:
              "Your session has expired. Please sign in again.",
          },
          { status: 401 }
        );

        response.cookies.delete(
          "raygo_mail_session"
        );

        return response;
      }

      return NextResponse.json({
        user: users[0],
      });
    } finally {
      await sql.end();
    }
  } catch (error) {
    console.error(
      "RayGo Mail account check error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to open your account right now.",
      },
      { status: 500 }
    );
  }
} 
