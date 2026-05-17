import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const userEmail = profile?.email ?? null;

  return NextResponse.json({
    resendKeyExists: !!process.env.RESEND_API_KEY,
    fromEmail:       "Briefd <onboarding@resend.dev>",
    userEmail:       userEmail ? userEmail.slice(0, 3) + "***" : null,
  });
}
