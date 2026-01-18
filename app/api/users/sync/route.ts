import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";

/**
 * GET /api/users/sync
 *
 * Called after Clerk redirect (e.g. from /loading). Uses currentUser() to get
 * the signed-in user from Clerk, then upserts them into MongoDB.
 *
 * User data comes from Clerk's session — after SignInButton redirect,
 * Clerk sets the session cookie, so currentUser() works on the next request.
 */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const primaryEmail =
      user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;

    const doc = {
      clerkId: user.id,
      email: primaryEmail,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      imageUrl: user.imageUrl ?? null,
      updatedAt: new Date(),
    };

    const db = await getDb();
    await db.collection("users").updateOne(
      { clerkId: user.id },
      {
        $set: doc,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[GET /api/users/sync]", e);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }
}
