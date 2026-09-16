import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;

const sql = connectionString
  ? postgres(connectionString, {
      ssl: "require",
    })
  : null;

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: "RayGo Mail database is not connected." },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("raygo_mail_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(sessionToken)
      .digest("hex");

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
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      );

      response.cookies.delete("raygo_mail_session");
      return response;
    }

    return NextResponse.json({
      user: users[0],
    });
  } catch (error) {
    console.error("RayGo Mail account check error:", error);

    return NextResponse.json(
      { error: "Unable to open your account right now." },
      { status: 500 }
    );
  }
} 
