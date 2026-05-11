import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { shouldSendDigest } from "@/lib/email/scheduler";
import type { Profile } from "@/lib/types";

// POST /api/email/schedule
// Updates the user's digest_time and digest_frequency,
// then returns whether a send is due right now.
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { digest_time?: string; digest_frequency?: string } = {};
  try { body = await request.json(); } catch { /* no body is fine */ }

  if (body.digest_time || body.digest_frequency) {
    const { error } = await supabase
      .from("profiles")
      .update({
        ...(body.digest_time      && { digest_time:      body.digest_time }),
        ...(body.digest_frequency && { digest_frequency: body.digest_frequency }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    success:     true,
    sendDueNow:  profile ? shouldSendDigest(profile as Profile) : false,
    digest_time: profile?.digest_time,
  });
}
