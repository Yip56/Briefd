import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/onboarding/ProfileForm";
import { DigestFeed } from "@/components/digest/DigestFeed";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Onboarding: profile missing or occupation never set
  if (!profile || !profile.occupation) {
    return (
      <div className="py-4">
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-brand">Welcome to Briefd</h1>
          <p className="mt-1 text-sm text-gray-500">
            Let&apos;s personalise your daily digest in 3 quick steps.
          </p>
        </div>
        <ProfileForm />
      </div>
    );
  }

  return <DigestFeed />;
}
