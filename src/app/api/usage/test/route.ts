import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const testSessionId = `test_${Date.now()}`;

  // Attempt a test INSERT
  const { error: insertError } = await supabase.from("gemini_usage").insert({
    user_id:           user.id,
    call_type:         "test",
    digest_session_id: testSessionId,
    provider:          "groq",
  });

  if (insertError) {
    console.error("[usage/test] INSERT failed:", insertError.message, insertError.code);
    return NextResponse.json({
      inserted: false,
      error:    insertError.message,
      hint:     "Check RLS policies on gemini_usage table — server may lack INSERT permission",
    });
  }

  // Verify the row landed
  const { count } = await supabase
    .from("gemini_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("digest_session_id", testSessionId);

  // Clean up test row
  await supabase.from("gemini_usage").delete().eq("digest_session_id", testSessionId);

  return NextResponse.json({
    inserted: (count ?? 0) >= 1,
    count:    count ?? 0,
    message:  (count ?? 0) >= 1
      ? "Tracking pipeline works — Supabase writes are succeeding"
      : "INSERT appeared to succeed but row count is 0 — check RLS SELECT policy",
  });
}
