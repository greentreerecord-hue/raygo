import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;

const sql = connectionString
  ? postgres(connectionString, { ssl: "require" })
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      trashed_at TIMESTAMPTZ
    )
  `;

  await sql`
    ALTER TABLE raygo_mail_messages
    ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ
  `;
}

async function getSignedInUserId(): Promise<number | null> {
  if (!sql) {
    throw new Error("RayGo Mail database is not connected.");
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("raygo_mail_session")?.value;

  if (!sessionToken) {
    return null;
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

  return users.length > 0 ? Number(users[0].id) : null;
}

export async function GET(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: "RayGo Mail database is not connected." },
        { status: 500 }
      );
    }

    const userId = await getSignedInUserId();

    if (userId === null) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    await ensureMessagesTable();

    const folder = request.nextUrl.searchParams.get("folder");

    if (folder !== null && folder !== "trash") {
      return NextResponse.json(
        { error: "Unknown mail folder." },
        { status: 400 }
      );
    }

    const messages = folder === "trash"
      ? await sql`
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
          WHERE messages.recipient_id = ${userId}
            AND messages.trashed_at IS NOT NULL
          ORDER BY messages.trashed_at DESC
          LIMIT 100
        `
      : await sql`
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
          WHERE messages.recipient_id = ${userId}
            AND messages.trashed_at IS NULL
          ORDER BY messages.created_at DESC
          LIMIT 100
        `;

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("RayGo Mail messages error:", error);

    return NextResponse.json(
      { error: "Unable to load your messages right now." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: "RayGo Mail database is not connected." },
        { status: 500 }
      );
    }

    const userId = await getSignedInUserId();

    if (userId === null) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const id = Number(body.id);
    const action = body.action;

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      (action !== "trash" && action !== "restore")
    ) {
      return NextResponse.json(
        { error: "Invalid message or action." },
        { status: 400 }
      );
    }

    await ensureMessagesTable();

    const updated = action === "trash"
      ? await sql`
          UPDATE raygo_mail_messages
          SET trashed_at = NOW()
          WHERE id = ${id}
            AND recipient_id = ${userId}
            AND trashed_at IS NULL
          RETURNING id
        `
      : await sql`
          UPDATE raygo_mail_messages
          SET trashed_at = NULL
          WHERE id = ${id}
            AND recipient_id = ${userId}
            AND trashed_at IS NOT NULL
          RETURNING id
        `;

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Message not found in this folder." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RayGo Mail move message error:", error);

    return NextResponse.json(
      { error: "Unable to move your message right now." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: "RayGo Mail database is not connected." },
        { status: 500 }
      );
    }

    const userId = await getSignedInUserId();

    if (userId === null) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    await ensureMessagesTable();

    const deleted = await sql`
      DELETE FROM raygo_mail_messages
      WHERE recipient_id = ${userId}
        AND trashed_at IS NOT NULL
      RETURNING id
    `;

    return NextResponse.json({
      success: true,
      deletedCount: deleted.length,
    });
  } catch (error) {
    console.error("RayGo Mail empty trash error:", error);

    return NextResponse.json(
      { error: "Unable to empty Trash right now." },
      { status: 500 }
    );
  }
} 
