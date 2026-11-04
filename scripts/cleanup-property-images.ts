import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before cleaning legacy property images.");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const bucket = supabase.storage.from("property-images");
  const paths: string[] = [];

  async function collect(prefix = "", offset = 0): Promise<void> {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Could not list ${prefix || "property-images"}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) await collect(path);
      else paths.push(path);
    }
    if ((data?.length ?? 0) === 1000) await collect(prefix, offset + 1000);
  }

  await collect();
  for (let offset = 0; offset < paths.length; offset += 1000) {
    const { error } = await bucket.remove(paths.slice(offset, offset + 1000));
    if (error) throw new Error(`Could not remove legacy property images: ${error.message}`);
  }
  console.log(`Removed ${paths.length} legacy property image object${paths.length === 1 ? "" : "s"}.`);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
