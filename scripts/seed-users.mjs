// Creates 3 dummy accounts with email already confirmed.
// Run with: node --env-file=.env.local scripts/seed-users.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DUMMY_USERS = [
  {
    email:      "test1@briefd.app",
    password:   "password123",
    occupation: "Employed (Private)",
    location:   "Kuala Lumpur",
    life_stage: "Renting",
    vehicle:    "Car owner",
  },
  {
    email:      "test2@briefd.app",
    password:   "password123",
    occupation: "Student",
    location:   "Selangor",
    life_stage: "Living with family",
    vehicle:    "Motorcycle owner",
  },
  {
    email:      "test3@briefd.app",
    password:   "password123",
    occupation: "Business Owner",
    location:   "Penang",
    life_stage: "Property owner",
    vehicle:    "Both",
  },
];

for (const user of DUMMY_USERS) {
  process.stdout.write(`Creating ${user.email} … `);

  // Create auth user with email already confirmed
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:            user.email,
    password:         user.password,
    email_confirm:    true,
  });

  if (authError) {
    // If user already exists, look them up instead
    if (authError.message.includes("already been registered") || authError.code === "email_exists") {
      console.log("already exists, skipping.");
      continue;
    }
    console.error(`FAILED — ${authError.message}`);
    continue;
  }

  const userId = authData.user.id;

  // Upsert profile row
  const { error: profileError } = await supabase.from("profiles").upsert({
    id:           userId,
    email:        user.email,
    occupation:   user.occupation,
    location:     user.location,
    life_stage:   user.life_stage,
    vehicle:      user.vehicle,
    digest_time:  "08:00",
    digest_frequency: "daily",
    email_digest_enabled: false,   // off by default for test accounts
  });

  if (profileError) {
    console.error(`created auth user but profile failed — ${profileError.message}`);
    continue;
  }

  // Seed a couple of topics
  const topics = ["Economy", "Malaysian Politics", "Tech & AI"];
  await supabase.from("user_topics").insert(
    topics.map((topic) => ({ user_id: userId, topic, is_preset: true, weight: 1.0 }))
  );

  console.log("done ✓");
}

console.log("\nDummy accounts ready:");
console.log("  test1@briefd.app / password123");
console.log("  test2@briefd.app / password123");
console.log("  test3@briefd.app / password123");
