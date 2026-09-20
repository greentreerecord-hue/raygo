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

    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json(
        { error: "This verification link is invalid." },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const verified = await sql.begin(async (transaction) => {
      const matches = await transaction`
        DELETE FROM raygo_mail_recovery_verifications
        WHERE token_hash = ${tokenHash}
          AND expires_at > NOW()
        RETURNING user_id, email
      `;

      if (matches.length === 0) return false;

      const updated = await transaction`
        UPDATE raygo_mail_users
        SET recovery_email_verified_at = NOW()
        WHERE id = ${matches[0].user_id}
          AND recovery_email = ${matches[0].email}
        RETURNING id
      `;

      return updated.length > 0;
    });

    if (!verified) {
      return NextResponse.json(
        { error: "This link has expired or has already been used." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Your recovery email is verified.",
    });
  } catch (error) {
    console.error("Recovery email verification error:", error);

    return NextResponse.json(
      { error: "Could not verify your recovery email." },
      { status: 500 }
    );
  }
} 
