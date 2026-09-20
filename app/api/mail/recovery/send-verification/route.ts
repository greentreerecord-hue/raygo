import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;
const sql = connectionString
  ? postgres(connectionString, { ssl: "require" })
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!sql || !process.env.RESEND_API_KEY) {
      throw new Error("Recovery email service is not configured.");
    }

    const sessionToken = request.cookies.get(
      "raygo_mail_session"
    )?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    const sessionHash = createHash("sha256")
      .update(sessionToken)
      .digest("hex");

    const users = await sql`
      SELECT u.id, u.recovery_email,
             u.recovery_email_verified_at
      FROM raygo_mail_sessions s
      JOIN raygo_mail_users u ON u.id = s.user_id
      WHERE s.token_hash = ${sessionHash}
        AND s.expires_at > NOW()
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    const user = users[0];

    if (!user.recovery_email) {
      return NextResponse.json(
        { error: "Add a recovery email first." },
        { status: 400 }
      );
    }

    if (user.recovery_email_verified_at) {
      return NextResponse.json({
        message: "Your recovery email is already verified.",
      });
    }

    await sql`
      CREATE TABLE IF NOT EXISTS raygo_mail_recovery_verifications (
        user_id INTEGER PRIMARY KEY
          REFERENCES raygo_mail_users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const saved = await sql`
      INSERT INTO raygo_mail_recovery_verifications (
        user_id, email, token_hash, expires_at, sent_at
      )
      VALUES (
        ${user.id},
        ${user.recovery_email},
        ${tokenHash},
        ${expiresAt},
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        sent_at = NOW()
      WHERE raygo_mail_recovery_verifications.sent_at
        < NOW() - INTERVAL '5 minutes'
      RETURNING user_id
    `;

    if (saved.length === 0) {
      return NextResponse.json(
        { error: "Please wait five minutes before requesting another email." },
        { status: 429 }
      );
    }

    const link =
      `https://raygoes.com/mail/verify-recovery?token=${token}`;

    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RayGo Mail <no-reply@account.raygoes.com>",
        to: [user.recovery_email],
        subject: "Verify your RayGo Mail recovery email",
        text:
          `Open this link to verify your recovery email:\n\n${link}\n\n` +
          "The link expires in one hour. If you did not request this, ignore this email.",
      }),
    });

    if (!sent.ok) {
      console.error(
        "Resend verification failed:",
        sent.status,
        await sent.text()
      );

      await sql`
        DELETE FROM raygo_mail_recovery_verifications
        WHERE user_id = ${user.id}
          AND token_hash = ${tokenHash}
      `;

      return NextResponse.json(
        { error: "Could not send the verification email. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: "Check your recovery email for a verification link.",
    });
  } catch (error) {
    console.error("Recovery verification error:", error);
    return NextResponse.json(
      { error: "Could not send the verification email." },
      { status: 500 }
    );
  }
} 
