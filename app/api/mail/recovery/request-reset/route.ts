import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;
const sql = connectionString
  ? postgres(connectionString, { ssl: "require" })
  : null;

const publicMessage =
  "If this account has a verified recovery email, we will send a password reset link.";

export async function POST(request: Request) {
  try {
    if (!sql || !process.env.RESEND_API_KEY) {
      throw new Error("Password recovery is not configured.");
    }

    const body = await request.json();
    const account = String(body.account || "")
      .trim()
      .toLowerCase();

    if (!account || account.length > 254) {
      return NextResponse.json(
        { error: "Enter your RayGo Mail username or address." },
        { status: 400 }
      );
    }

    const users = await sql`
      SELECT id, recovery_email
      FROM raygo_mail_users
      WHERE (username = ${account} OR email = ${account})
        AND recovery_email IS NOT NULL
        AND recovery_email_verified_at IS NOT NULL
      LIMIT 1
    `;

    // Give the same response whether or not the account exists.
    if (users.length === 0) {
      return NextResponse.json({ message: publicMessage });
    }

    await sql`
      CREATE TABLE IF NOT EXISTS raygo_mail_password_resets (
        user_id INTEGER PRIMARY KEY
          REFERENCES raygo_mail_users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const user = users[0];
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const saved = await sql`
      INSERT INTO raygo_mail_password_resets (
        user_id, token_hash, expires_at, sent_at
      )
      VALUES (${user.id}, ${tokenHash}, ${expiresAt}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        sent_at = NOW()
      WHERE raygo_mail_password_resets.sent_at
        < NOW() - INTERVAL '5 minutes'
      RETURNING user_id
    `;

    if (saved.length === 0) {
      return NextResponse.json({ message: publicMessage });
    }

    const link =
      `https://raygoes.com/mail/reset-password?token=${token}`;

    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RayGo Mail <no-reply@account.raygoes.com>",
        to: [user.recovery_email],
        subject: "Reset your RayGo Mail password",
        text:
          `Open this link to reset your password:\n\n${link}\n\n` +
          "The link expires in one hour. If you did not request this, ignore this email.",
      }),
    });

    if (!sent.ok) {
      console.error("Resend password reset failed:", sent.status);
      await sql`
        DELETE FROM raygo_mail_password_resets
        WHERE user_id = ${user.id}
          AND token_hash = ${tokenHash}
      `;
    }

    return NextResponse.json({ message: publicMessage });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Could not process your request right now." },
      { status: 500 }
    );
  }
} 
