import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateGeminiProfile } from "@/lib/ai/feedback";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await updateGeminiProfile(user.id, supabase);

  const { data } = await supabase
    .from("user_algorithm_settings")
    .select("gemini_profile")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ gemini_profile: data?.gemini_profile ?? "" });
}
