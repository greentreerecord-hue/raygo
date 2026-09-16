import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;

const sql = connectionString
  ? postgres(connectionString, {
      ssl: "require",
    })
  : null;

async function ensureMailUsersTable() {
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
    const password = String(body.password || "");

    if (!name || !username || !password) {
      return NextResponse.json(
        { error: "Name, username, and password are required." },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { error: "Username must be between 3 and 30 characters." },
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
        { error: "That username is reserved. Please choose another." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    await ensureMailUsersTable();

    const email = `${username}@raygoes.com`;
    const passwordHash = await bcrypt.hash(password, 12);

    const existingUsers = await sql`
      SELECT id
      FROM raygo_mail_users
      WHERE username = ${username}
         OR email = ${email}
      LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: "That RayGo Mail username is already taken." },
        { status: 409 }
      );
    }

    const newUsers = await sql`
      INSERT INTO raygo_mail_users (
        name,
        username,
        email,
        password_hash
      )
      VALUES (
        ${name},
        ${username},
        ${email},
        ${passwordHash}
      )
      RETURNING id, name, username, email, created_at
    `;

    return NextResponse.json(
      {
        message: "Your RayGo Mail account was created.",
        user: newUsers[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("RayGo Mail signup error:", error);

    return NextResponse.json(
      { error: "Unable to create your account right now." },
      { status: 500 }
    );
  }
} 
