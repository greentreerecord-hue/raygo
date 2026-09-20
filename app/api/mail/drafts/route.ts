import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;

const sql = connectionString
  ? postgres(connectionString, { ssl: "require" })
  : null;

async function getSignedInUserId(): Promise<number | null> {
  if (!sql) {
    throw new Error("RayGo Mail database is not connected.");
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("raygo_mail_session")?.value;

  if (!sessionToken) return null;

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

async function ensureDraftsTable() {
  if (!sql) {
    throw new Error("RayGo Mail database is not connected.");
  }

  await sql`
    CREATE TABLE IF NOT EXISTS raygo_mail_drafts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES raygo_mail_users(id) ON DELETE CASCADE,
      to_email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      message_body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function draftFields(body: Record<string, unknown>) {
  return {
    to: String(body.to || "").trim(),
    subject: String(body.subject || "").trim(),
    message: String(body.message || ""),
  };
}

function fieldsError(fields: ReturnType<typeof draftFields>) {
  if (
    fields.to.length > 254 ||
    fields.subject.length > 200 ||
    fields.message.length > 10000
  ) {
    return "Draft is too long.";
  }

  if (!fields.to && !fields.subject && !fields.message.trim()) {
    return "Write something before saving a draft.";
  }

  return null;
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

    await ensureDraftsTable();

    const idParam = request.nextUrl.searchParams.get("id");

    if (idParam !== null) {
      const id = Number(idParam);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return NextResponse.json(
          { error: "Invalid draft." },
          { status: 400 }
        );
      }

      const drafts = await sql`
        SELECT id, to_email, subject, message_body, updated_at
        FROM raygo_mail_drafts
        WHERE id = ${id} AND user_id = ${userId}
        LIMIT 1
      `;

      if (drafts.length === 0) {
        return NextResponse.json(
          { error: "Draft not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({ draft: drafts[0] });
    }

    const drafts = await sql`
      SELECT id, to_email, subject, message_body, updated_at
      FROM raygo_mail_drafts
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("RayGo Mail drafts GET error:", error);

    return NextResponse.json(
      { error: "Unable to load drafts right now." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const fields = draftFields(await request.json());
    const error = fieldsError(fields);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    await ensureDraftsTable();

    const drafts = await sql`
      INSERT INTO raygo_mail_drafts (
        user_id, to_email, subject, message_body
      )
      VALUES (
        ${userId}, ${fields.to}, ${fields.subject}, ${fields.message}
      )
      RETURNING id, to_email, subject, message_body, updated_at
    `;

    return NextResponse.json({ draft: drafts[0] }, { status: 201 });
  } catch (error) {
    console.error("RayGo Mail drafts POST error:", error);

    return NextResponse.json(
      { error: "Unable to save draft right now." },
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
    const fields = draftFields(body);
    const error = fieldsError(fields);

    if (!Number.isSafeInteger(id) || id <= 0 || error) {
      return NextResponse.json(
        { error: error || "Invalid draft." },
        { status: 400 }
      );
    }

    await ensureDraftsTable();

    const drafts = await sql`
      UPDATE raygo_mail_drafts
      SET to_email = ${fields.to},
          subject = ${fields.subject},
          message_body = ${fields.message},
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id, to_email, subject, message_body, updated_at
    `;

    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "Draft not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ draft: drafts[0] });
  } catch (error) {
    console.error("RayGo Mail drafts PATCH error:", error);

    return NextResponse.json(
      { error: "Unable to update draft right now." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const id = Number(request.nextUrl.searchParams.get("id"));

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid draft." },
        { status: 400 }
      );
    }

    await ensureDraftsTable();

    const deleted = await sql`
      DELETE FROM raygo_mail_drafts
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Draft not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RayGo Mail drafts DELETE error:", error);

    return NextResponse.json(
      { error: "Unable to delete draft right now." },
      { status: 500 }
    );
  }
} 
