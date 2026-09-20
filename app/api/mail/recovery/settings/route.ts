import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;
const sql = connectionString
  ? postgres(connectionString, { ssl: "require" })
  : null;

async function getUser(request: NextRequest) {
  if (!sql) {
    throw new Error("RayGo Mail database is not connected.");
  }

  const sessionToken = request.cookies.get(
    "raygo_mail_session"
  )?.value;

  if (!sessionToken) return null;

  // Existing accounts may have been created before these columns existed.
  await sql`
    ALTER TABLE raygo_mail_users
    ADD COLUMN IF NOT EXISTS recovery_email TEXT
  `;
  await sql`
    ALTER TABLE raygo_mail_users
    ADD COLUMN IF NOT EXISTS recovery_email_verified_at TIMESTAMPTZ
  `;

  const sessionHash = createHash("sha256")
    .update(sessionToken)
    .digest("hex");

  const users = await sql`
    SELECT u.id, u.recovery_email,
           u.recovery_email_verified_at, u.password_hash
    FROM raygo_mail_sessions s
    JOIN raygo_mail_users u ON u.id = s.user_id
    WHERE s.token_hash = ${sessionHash}
      AND s.expires_at > NOW()
    LIMIT 1
  `;

  return users[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      recoveryEmail: user.recovery_email || "",
      verified: Boolean(user.recovery_email_verified_at),
    });
  } catch (error) {
    console.error("Recovery settings error:", error);
    return NextResponse.json(
      { error: "Could not load recovery settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!sql) {
      throw new Error("RayGo Mail database is not connected.");
    }

    const user = await getUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const recoveryEmail = String(body.recoveryEmail || "")
      .trim()
      .toLowerCase();
    const currentPassword = String(body.currentPassword || "");

    if (
      recoveryEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail) ||
      recoveryEmail.endsWith("@raygoes.com")
    ) {
      return NextResponse.json(
        { error: "Enter an email address outside RayGo Mail." },
        { status: 400 }
      );
    }

    if (
      !currentPassword ||
      !(await bcrypt.compare(
        currentPassword,
        user.password_hash
      ))
    ) {
      return NextResponse.json(
        { error: "Your current password is incorrect." },
        { status: 403 }
      );
    }

    if (
      user.recovery_email === recoveryEmail &&
      user.recovery_email_verified_at
    ) {
      return NextResponse.json({
        message: "That recovery email is already verified.",
        verified: true,
      });
    }

    await sql.begin(async (transaction) => {
      await transaction`
        UPDATE raygo_mail_users
        SET recovery_email = ${recoveryEmail},
            recovery_email_verified_at = NULL
        WHERE id = ${user.id}
      `;

      const table = await transaction`
        SELECT to_regclass(
          'public.raygo_mail_password_resets'
        ) AS table_name
      `;

      if (table[0]?.table_name) {
        await transaction`
          DELETE FROM raygo_mail_password_resets
          WHERE user_id = ${user.id}
        `;
      }
    });

    return NextResponse.json({
      message: "Recovery email saved. Send a verification link next.",
      verified: false,
    });
  } catch (error) {
    console.error("Recovery settings update error:", error);
    return NextResponse.json(
      { error: "Could not save your recovery email." },
      { status: 500 }
    );
  }
} 
