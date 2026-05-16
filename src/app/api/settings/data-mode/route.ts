import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IS_DEMO_MODE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieMode = request.cookies.get("briefd_data_mode")?.value;
  const mode = cookieMode === "live" ? "live" : cookieMode === "demo" ? "demo" : IS_DEMO_MODE ? "demo" : "live";
  return NextResponse.json({ mode });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { mode?: string };
  const mode = body.mode === "live" ? "live" : "demo";

  await supabase
    .from("user_algorithm_settings")
    .upsert(
      { user_id: user.id, data_mode: mode, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  const res = NextResponse.json({ mode });
  res.cookies.set("briefd_data_mode", mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
