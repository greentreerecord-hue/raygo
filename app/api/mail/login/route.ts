import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;

const sql = connectionString
  ? postgres(connectionString, {
      ssl: "require",
    })
  : null;

export async function POST(request: Request) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: "RayGo Mail database is not connected." },
        { status: 500 }
      );
    }

    const body = await request.json();

    let username = String(body.username || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (username.endsWith("@raygoes.com")) {
      username = username.slice(0, -13);
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const users = await sql`
      SELECT id, name, username, email, password_hash
      FROM raygo_mail_users
      WHERE username = ${username}
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: "The username or password is incorrect." },
        { status: 401 }
      );
    }

    const user = users[0];
    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        { error: "The username or password is incorrect." },
        { status: 401 }
      );
    }

    await sql`
      DELETE FROM raygo_mail_sessions
      WHERE expires_at <= NOW()
    `;

    const sessionToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(sessionToken)
      .digest("hex");
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    await sql`
      INSERT INTO raygo_mail_sessions (
        user_id,
        token_hash,
        expires_at
      )
      VALUES (
        ${user.id},
        ${tokenHash},
        ${expiresAt}
      )
    `;

    const response = NextResponse.json({
      message: "Welcome back.",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
    });

    response.cookies.set("raygo_mail_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("RayGo Mail login error:", error);

    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 }
    );
  }
} 
