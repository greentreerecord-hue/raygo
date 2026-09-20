import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const connectionString = process.env.RAYGO_MAIL_DB_DATABASE_URL;
const sql = connectionString
  ? postgres(connectionString, { ssl: "require" })
  : null;

export async function POST(request: Request) {
  try {
    if (!sql) {
      throw new Error("RayGo Mail database is not connected.");
    }

    const body = await request.json();
    const token = String(body.token || "");
    const password = String(body.password || "");

    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json(
        { error: "This reset link is invalid." },
        { status: 400 }
      );
    }

    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return NextResponse.json(
        { error: "Use a password of at least 8 characters and at most 72 bytes." },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");
    const passwordHash = await bcrypt.hash(password, 12);

    const reset = await sql.begin(async (transaction) => {
      const matches = await transaction`
        DELETE FROM raygo_mail_password_resets r
        USING raygo_mail_users u
        WHERE r.token_hash = ${tokenHash}
          AND r.expires_at > NOW()
          AND u.id = r.user_id
          AND u.recovery_email_verified_at IS NOT NULL
        RETURNING r.user_id
      `;

      if (matches.length === 0) return false;

      await transaction`
        UPDATE raygo_mail_users
        SET password_hash = ${passwordHash}
        WHERE id = ${matches[0].user_id}
      `;

      // Sign out every existing session after the password changes.
      await transaction`
        DELETE FROM raygo_mail_sessions
        WHERE user_id = ${matches[0].user_id}
      `;

      return true;
    });

    if (!reset) {
      return NextResponse.json(
        { error: "This reset link has expired or has already been used." },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      message: "Password changed. Sign in with your new password.",
    });

    response.cookies.delete("raygo_mail_session");
    return response;
  } catch (error) {
    console.error("Password reset error:", error);

    return NextResponse.json(
      { error: "Could not reset your password right now." },
      { status: 500 }
    );
  }
} 
