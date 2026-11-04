"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";

type CancellationPolicy = { free_cancellation_hours?: number; refund_percent_after_window?: number };
const defaultPolicy: CancellationPolicy = { free_cancellation_hours: 72, refund_percent_after_window: 50 };

export function AdminSettingsPanel({ settings }: { settings: Record<string, unknown> }) {
  const [depositEnabled, setDepositEnabled] = useState(Boolean(settings.deposit_enabled));
  const [depositPercent, setDepositPercent] = useState(Number(settings.deposit_percent ?? 30));
  const [gstPercent, setGstPercent] = useState(Number(settings.gst_percent ?? 5));
  const [policy, setPolicy] = useState<CancellationPolicy>(readPolicy(settings.cancellation_policy));
  const [legalName, setLegalName] = useState(String(settings.invoice_legal_name ?? ""));
  const [gstin, setGstin] = useState(String(settings.invoice_gstin ?? ""));
  const [address, setAddress] = useState(String(settings.invoice_address ?? ""));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setDepositEnabled(Boolean(settings.deposit_enabled)); setDepositPercent(Number(settings.deposit_percent ?? 30)); setGstPercent(Number(settings.gst_percent ?? 5));
    setPolicy(readPolicy(settings.cancellation_policy)); setLegalName(String(settings.invoice_legal_name ?? "")); setGstin(String(settings.invoice_gstin ?? "")); setAddress(String(settings.invoice_address ?? ""));
  }, [settings]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deposit_enabled: depositEnabled, deposit_percent: depositPercent, gst_percent: gstPercent, cancellation_policy: policy, invoice_legal_name: legalName, invoice_gstin: gstin, invoice_address: address }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setNotice("Settings saved. New holds use these values."); else setError(result.error ?? "Settings could not be saved.");
    setBusy(false);
  }
  return <form onSubmit={save} className="grid max-w-4xl gap-6"><section className="border border-ink/10 bg-[#fbf8f1] p-5 md:p-7"><p className="eyebrow text-laterite">Booking money</p><h2 className="mt-1 font-display text-3xl">The way guests pay.</h2><label className="mt-5 flex items-center justify-between gap-5 border border-ink/10 p-4"><span><span className="block text-sm font-semibold">Offer a deposit</span><span className="mt-1 block text-xs text-ink/50">Guests can pay part now and the balance at check-in.</span></span><input type="checkbox" checked={depositEnabled} onChange={(event) => setDepositEnabled(event.target.checked)} className="h-5 w-5 accent-laterite" /></label>{depositEnabled && <label className="mt-4 grid max-w-xs gap-2 text-xs">Deposit percentage<input type="number" min={1} max={99} value={depositPercent} onChange={(event) => setDepositPercent(Number(event.target.value))} className="h-11 border border-ink/15 bg-paper px-3 text-sm" /></label>}<label className="mt-4 grid max-w-xs gap-2 text-xs">GST estimate (%)<input type="number" min={0} max={28} step=".1" value={gstPercent} onChange={(event) => setGstPercent(Number(event.target.value))} className="h-11 border border-ink/15 bg-paper px-3 text-sm" /></label></section>
    <section className="border border-ink/10 bg-[#fbf8f1] p-5 md:p-7"><p className="eyebrow text-laterite">Cancellation policy</p><h2 className="mt-1 font-display text-3xl">A clear promise.</h2><p className="mt-2 text-xs text-ink/50">This setting is shown in the host workflow. Refunds are still issued by the owner.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs">Free cancellation until (hours before check-in)<input type="number" min={0} max={8760} value={policy.free_cancellation_hours ?? 72} onChange={(event) => setPolicy((value) => ({ ...value, free_cancellation_hours: Number(event.target.value) }))} className="h-11 border border-ink/15 bg-paper px-3 text-sm" /></label><label className="grid gap-2 text-xs">Refund after that window (%)<input type="number" min={0} max={100} value={policy.refund_percent_after_window ?? 50} onChange={(event) => setPolicy((value) => ({ ...value, refund_percent_after_window: Number(event.target.value) }))} className="h-11 border border-ink/15 bg-paper px-3 text-sm" /></label></div></section>
    <section className="border border-ink/10 bg-[#fbf8f1] p-5 md:p-7"><p className="eyebrow text-laterite">Invoice details</p><h2 className="mt-1 font-display text-3xl">Who the invoice comes from.</h2><div className="mt-5 grid gap-4"><label className="grid gap-2 text-xs">Legal owner name<input value={legalName} onChange={(event) => setLegalName(event.target.value)} className="h-11 border border-ink/15 bg-paper px-3 text-sm" /></label><label className="grid gap-2 text-xs">GSTIN<input value={gstin} maxLength={15} onChange={(event) => setGstin(event.target.value.toUpperCase())} className="h-11 border border-ink/15 bg-paper px-3 text-sm" /></label><label className="grid gap-2 text-xs">Registered address<textarea rows={3} value={address} onChange={(event) => setAddress(event.target.value)} className="border border-ink/15 bg-paper p-3 text-sm" /></label></div><p className="mt-4 text-[10px] leading-4 text-ink/45">Use your accountant’s advice to set the correct tax rate and invoice fields before taking real payments.</p></section>
    {notice && <p role="status" className="text-xs text-lagoon">{notice}</p>}{error && <p role="alert" className="text-xs text-laterite">{error}</p>}<button disabled={busy} className="button-ink w-fit disabled:opacity-45">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Save settings</button></form>;
}

function readPolicy(value: unknown): CancellationPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultPolicy;
  const policy = value as Record<string, unknown>;
  return {
    free_cancellation_hours: typeof policy.free_cancellation_hours === "number" ? policy.free_cancellation_hours : defaultPolicy.free_cancellation_hours,
    refund_percent_after_window: typeof policy.refund_percent_after_window === "number" ? policy.refund_percent_after_window : defaultPolicy.refund_percent_after_window
  };
}
