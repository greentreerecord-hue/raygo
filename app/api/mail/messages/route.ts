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

async function ensureMessagesTable() {
  if (!sql) {
    throw new Error("RayGo Mail database is not connected.");
  }

  await sql`
    CREATE TABLE IF NOT EXISTS raygo_mail_messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL
        REFERENCES raygo_mail_users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL
        REFERENCES raygo_mail_users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      message_body TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

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
      SELECT users.id
      FROM raygo_mail_sessions AS sessions
      JOIN raygo_mail_users AS users
        ON users.id = sessions.user_id
      WHERE sessions.token_hash = ${tokenHash}
        AND sessions.expires_at > NOW()
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: "Your session expired. Please sign in again." },
        { status: 401 }
      );
    }

    await ensureMessagesTable();

    const messages = await sql`
      SELECT
        messages.id,
        messages.subject,
        messages.message_body,
        messages.read_at,
        messages.created_at,
        senders.name AS sender_name,
        senders.email AS sender_email
      FROM raygo_mail_messages AS messages
      JOIN raygo_mail_users AS senders
        ON senders.id = messages.sender_id
      WHERE messages.recipient_id = ${users[0].id}
      ORDER BY messages.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      messages,
    });
  } catch (error) {
    console.error("RayGo Mail inbox error:", error);

    return NextResponse.json(
      { error: "Unable to load your inbox right now." },
      { status: 500 }
    );
  }
} 
