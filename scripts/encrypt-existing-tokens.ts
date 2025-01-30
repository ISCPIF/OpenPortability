import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "./scripts/.env" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: "next-auth"
      }
    }
  )

async function clearTokens() {
  console.log("Starting token cleanup...");

  const { data, error } = await supabase
    .from("accounts")
    .update({
      access_token: null,
      refresh_token: null
    })
    .not("access_token", "is", null)
    .select();

  if (error) {
    console.error("Error clearing tokens:", error);
    return;
  }

  console.log("Successfully cleared all tokens from accounts table");
  console.log(`Number of accounts affected: ${data?.length || 0}`);
}

clearTokens()
  .catch(console.error)
  .finally(() => process.exit());