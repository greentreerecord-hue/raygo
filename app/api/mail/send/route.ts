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

  await sql`
    CREATE INDEX IF NOT EXISTS raygo_mail_recipient_index
    ON raygo_mail_messages (recipient_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS raygo_mail_sender_index
    ON raygo_mail_messages (sender_id, created_at DESC)
  `;
}

export async function POST(request: Request) {
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

    const senders = await sql`
      SELECT users.id, users.email
      FROM raygo_mail_sessions AS sessions
      JOIN raygo_mail_users AS users
        ON users.id = sessions.user_id
      WHERE sessions.token_hash = ${tokenHash}
        AND sessions.expires_at > NOW()
      LIMIT 1
    `;

    if (senders.length === 0) {
      return NextResponse.json(
        { error: "Your session expired. Please sign in again." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const recipientEmail = String(body.to || "")
      .trim()
      .toLowerCase();
    const subject = String(body.subject || "").trim();
    const messageBody = String(body.message || "").trim();

    if (!recipientEmail || !subject || !messageBody) {
      return NextResponse.json(
        { error: "To, subject, and message are required." },
        { status: 400 }
      );
    }

    if (!recipientEmail.endsWith("@raygoes.com")) {
      return NextResponse.json(
        {
          error:
            "Internal mail currently supports @raygoes.com addresses only.",
        },
        { status: 400 }
      );
    }

    if (subject.length > 200) {
      return NextResponse.json(
        { error: "Subject must be 200 characters or fewer." },
        { status: 400 }
      );
    }

    if (messageBody.length > 10000) {
      return NextResponse.json(
        { error: "Message must be 10,000 characters or fewer." },
        { status: 400 }
      );
    }

    const recipients = await sql`
      SELECT id, email
      FROM raygo_mail_users
      WHERE email = ${recipientEmail}
      LIMIT 1
    `;

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "That RayGo Mail address does not exist." },
        { status: 404 }
      );
    }

    await ensureMessagesTable();

    const messages = await sql`
      INSERT INTO raygo_mail_messages (
        sender_id,
        recipient_id,
        subject,
        message_body
      )
      VALUES (
        ${senders[0].id},
        ${recipients[0].id},
        ${subject},
        ${messageBody}
      )
      RETURNING id, subject, created_at
    `;

    return NextResponse.json(
      {
        message: "Message sent.",
        sentMessage: messages[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("RayGo Mail send error:", error);

    return NextResponse.json(
      { error: "Unable to send your message right now." },
      { status: 500 }
    );
  }
} 
