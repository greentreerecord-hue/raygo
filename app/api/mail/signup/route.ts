import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;

const sql = connectionString
  ? postgres(connectionString, { ssl: "require" })
  : null;

async function ensureMailTables() {
  if (!sql) {
    throw new Error("RayGo Mail database is not connected.");
  }

  await sql`
    CREATE TABLE IF NOT EXISTS raygo_mail_users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      recovery_email TEXT,
      recovery_email_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Also update the table if it was created before recovery emails existed.
  await sql`
    ALTER TABLE raygo_mail_users
    ADD COLUMN IF NOT EXISTS recovery_email TEXT
  `;

  await sql`
    ALTER TABLE raygo_mail_users
    ADD COLUMN IF NOT EXISTS recovery_email_verified_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS raygo_mail_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES raygo_mail_users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
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

    const body = await request.json();

    const name = String(body.name || "").trim();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const recoveryEmail = String(body.recoveryEmail || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!name || !username || !recoveryEmail || !password) {
      return NextResponse.json(
        {
          error:
            "Name, username, recovery email, and password are required.",
        },
        { status: 400 }
      );
    }

    if (name.length > 80) {
      return NextResponse.json(
        { error: "Name must be 80 characters or fewer." },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        {
          error:
            "Username must be between 3 and 30 characters.",
        },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9._-]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username may only contain letters, numbers, periods, underscores, and hyphens.",
        },
        { status: 400 }
      );
    }

    const reservedNames = [
      "admin",
      "support",
      "postmaster",
      "abuse",
      "security",
      "webmaster",
      "noreply",
    ];

    if (reservedNames.includes(username)) {
      return NextResponse.json(
        {
          error:
            "That username is reserved. Please choose another.",
        },
        { status: 400 }
      );
    }

    if (
      recoveryEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail) ||
      recoveryEmail.endsWith("@raygoes.com")
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid recovery email outside RayGo Mail.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    await ensureMailTables();

    const email = `${username}@raygoes.com`;

    const existingUsers = await sql`
      SELECT id
      FROM raygo_mail_users
      WHERE username = ${username}
         OR email = ${email}
      LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json(
        {
          error:
            "That RayGo Mail username is already taken.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const sessionToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(sessionToken)
      .digest("hex");
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    const newUser = await sql.begin(async (transaction) => {
      const users = await transaction`
        INSERT INTO raygo_mail_users (
          name,
          username,
          email,
          password_hash,
          recovery_email
        )
        VALUES (
          ${name},
          ${username},
          ${email},
          ${passwordHash},
          ${recoveryEmail}
        )
        RETURNING id, name, username, email, created_at
      `;

      await transaction`
        INSERT INTO raygo_mail_sessions (
          user_id,
          token_hash,
          expires_at
        )
        VALUES (
          ${users[0].id},
          ${tokenHash},
          ${expiresAt}
        )
      `;

      return users[0];
    });

    const response = NextResponse.json(
      {
        message: "Your RayGo Mail account was created.",
        user: newUser,
      },
      { status: 201 }
    );

    response.cookies.set("raygo_mail_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("RayGo Mail signup error:", error);

    const databaseError = error as { code?: string };

    if (databaseError.code === "23505") {
      return NextResponse.json(
        {
          error:
            "That RayGo Mail username is already taken.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Unable to create your account right now.",
      },
      { status: 500 }
    );
  }
} 
