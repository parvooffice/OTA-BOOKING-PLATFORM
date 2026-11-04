import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  deposit_enabled: z.boolean(),
  deposit_percent: z.number().int().min(1).max(99),
  gst_percent: z.number().min(0).max(28),
  cancellation_policy: z.object({
    free_cancellation_hours: z.number().int().min(0).max(8760),
    refund_percent_after_window: z.number().int().min(0).max(100)
  }),
  invoice_legal_name: z.string().max(200),
  invoice_gstin: z.string().max(15),
  invoice_address: z.string().max(500)
});

export async function PUT(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the settings fields." }, { status: 400 });
  const values = parsed.data;
  const rows = [
    { key: "deposit_enabled", value: values.deposit_enabled }, { key: "deposit_percent", value: values.deposit_percent },
    { key: "gst_percent", value: values.gst_percent }, { key: "cancellation_policy", value: values.cancellation_policy },
    { key: "invoice_legal_name", value: values.invoice_legal_name }, { key: "invoice_gstin", value: values.invoice_gstin },
    { key: "invoice_address", value: values.invoice_address }
  ];
  const { error } = await service.from("admin_settings").upsert(rows.map((row) => ({ ...row, updated_at: new Date().toISOString() })), { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Settings could not be saved." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
