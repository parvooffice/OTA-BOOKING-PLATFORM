"use client";

import { useState } from "react";
import { LoaderCircle, Plus, Save } from "lucide-react";

type Property = { id: string; slug: string; name: string; district: string; base_price_inr: number; cleaning_fee_inr: number; max_guests: number; is_active: boolean; tagline?: string; description?: string; lat?: number; lng?: number; address?: string; bedrooms?: number; bathrooms?: number; amenities?: string[]; house_rules?: string[] };
type SeasonalRate = { id: string; property_id: string; range: string; nightly_rate_inr: number; label: string; properties: { name: string; slug: string } | null };

export function AdminPropertyManager({ properties, seasonalRates }: { properties: Property[]; seasonalRates: SeasonalRate[] }) {
  const [selectedId, setSelectedId] = useState(properties[0]?.id ?? "");
  const selected = properties.find((property) => property.id === selectedId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [rateStart, setRateStart] = useState("");
  const [rateEnd, setRateEnd] = useState("");
  const [rateAmount, setRateAmount] = useState("");
  const [rateLabel, setRateLabel] = useState("");

  async function saveProperty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      id: selected.id, name: String(form.get("name")), tagline: String(form.get("tagline")), description: String(form.get("description")), district: String(form.get("district")),
      lat: Number(form.get("lat")), lng: Number(form.get("lng")), address: String(form.get("address")),
      base_price_inr: Number(form.get("base_price_inr")), cleaning_fee_inr: Number(form.get("cleaning_fee_inr")), max_guests: Number(form.get("max_guests")),
      bedrooms: Number(form.get("bedrooms")), bathrooms: Number(form.get("bathrooms")), amenities: String(form.get("amenities")).split("\n").map((line) => line.trim()).filter(Boolean),
      house_rules: String(form.get("house_rules")).split("\n").map((line) => line.trim()).filter(Boolean), checkin_start: String(form.get("checkin_start")), checkin_end: String(form.get("checkin_end")), checkout_latest: String(form.get("checkout_latest")),
      is_active: form.get("is_active") === "on"
    };
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/properties", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setNotice("Property details saved."); else setError(result.error ?? "Property could not be saved.");
    setBusy(false);
  }

  async function addSeasonalRate(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/properties", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasonalRate: { property_id: selected.id, start_date: rateStart, end_date: rateEnd, nightly_rate_inr: Number(rateAmount), label: rateLabel } }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setNotice("Seasonal rate added."); setRateStart(""); setRateEnd(""); setRateAmount(""); setRateLabel(""); }
    else setError(result.error ?? "Seasonal rate could not be saved.");
    setBusy(false);
  }

  return <div className="grid gap-6 xl:grid-cols-[230px_1fr]"><aside className="grid content-start gap-1">{properties.map((property, index) => <button key={property.id} onClick={() => setSelectedId(property.id)} className={`border-l-2 px-3 py-3 text-left ${property.id === selectedId ? "border-laterite bg-[#e9e1d2]" : "border-transparent hover:bg-[#fbf8f1]"}`}><span className="eyebrow text-ink/40">Stay 0{index + 1}</span><span className="mt-1 block font-display text-xl">{property.name}</span><span className="mt-1 block text-[10px] text-ink/45">{property.district} · {property.is_active ? "Live" : "Hidden"}</span></button>)}</aside>{selected && <section className="min-w-0"><div className="mb-5 flex items-end justify-between gap-4 border-b border-ink/10 pb-4"><div><p className="eyebrow text-laterite">Property details · {selected.slug}</p><h2 className="mt-1 font-display text-3xl">Make it your own.</h2></div><span className="text-[10px] text-ink/45">Edit the four owner-listed homes</span></div>{(notice || error) && <p role={error ? "alert" : "status"} className={`mb-4 text-xs ${error ? "text-laterite" : "text-lagoon"}`}>{error || notice}</p>}<form onSubmit={saveProperty} className="grid gap-4 sm:grid-cols-2">{textField("Property name", "name", selected.name)}{textField("District", "district", selected.district)}{textField("Tagline", "tagline", selected.tagline ?? "")}{textField("Street / locality", "address", selected.address ?? "")}{numberField("Base nightly rate (₹)", "base_price_inr", selected.base_price_inr)}{numberField("Cleaning fee (₹)", "cleaning_fee_inr", selected.cleaning_fee_inr)}{numberField("Maximum guests", "max_guests", selected.max_guests)}{numberField("Bedrooms", "bedrooms", selected.bedrooms ?? 1)}{numberField("Bathrooms", "bathrooms", selected.bathrooms ?? 1)}{numberField("Latitude", "lat", selected.lat ?? 20)}{numberField("Longitude", "lng", selected.lng ?? 85)}<label className="flex h-11 items-center gap-3 border border-ink/15 bg-[#fbf8f1] px-3 text-xs"><input type="checkbox" name="is_active" defaultChecked={selected.is_active} className="accent-laterite" /> Visible to guests</label><label className="grid gap-2 text-[11px] font-semibold sm:col-span-2">A note about the stay<textarea name="description" defaultValue={selected.description ?? ""} rows={4} className="border border-ink/15 bg-[#fbf8f1] p-3 text-sm font-normal outline-none focus:border-laterite" /></label><label className="grid gap-2 text-[11px] font-semibold">Amenities · one per line<textarea name="amenities" defaultValue={(selected.amenities ?? []).join("\n")} rows={5} className="border border-ink/15 bg-[#fbf8f1] p-3 text-xs font-normal outline-none focus:border-laterite" /></label><label className="grid gap-2 text-[11px] font-semibold">House rules · one per line<textarea name="house_rules" defaultValue={(selected.house_rules ?? []).join("\n")} rows={5} className="border border-ink/15 bg-[#fbf8f1] p-3 text-xs font-normal outline-none focus:border-laterite" /></label><div className="sm:col-span-2"><p className="eyebrow text-ink/50">Arrival & departure</p><div className="mt-2 grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-[10px]">Check-in opens<input type="time" name="checkin_start" defaultValue="10:00" className="h-10 border border-ink/15 bg-[#fbf8f1] px-3 text-xs" /></label><label className="grid gap-1 text-[10px]">Check-in closes<input type="time" name="checkin_end" defaultValue="20:00" className="h-10 border border-ink/15 bg-[#fbf8f1] px-3 text-xs" /></label><label className="grid gap-1 text-[10px]">Latest check-out<input type="time" name="checkout_latest" defaultValue="09:00" className="h-10 border border-ink/15 bg-[#fbf8f1] px-3 text-xs" /></label></div></div><button disabled={busy} className="button-ink w-fit disabled:opacity-50">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Save property</button></form>
    <div className="mt-10 border-t border-ink/10 pt-6"><p className="eyebrow text-laterite">Seasonal pricing</p><h3 className="mt-1 font-display text-2xl">Set the right rate for the right dates.</h3><form onSubmit={addSeasonalRate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_1fr_auto]"><label className="grid gap-1 text-[10px]">From<input required type="date" value={rateStart} onChange={(event) => setRateStart(event.target.value)} className="h-10 border border-ink/15 bg-[#fbf8f1] px-2 text-xs" /></label><label className="grid gap-1 text-[10px]">To (checkout)<input required type="date" value={rateEnd} onChange={(event) => setRateEnd(event.target.value)} className="h-10 border border-ink/15 bg-[#fbf8f1] px-2 text-xs" /></label><label className="grid gap-1 text-[10px]">Label<input value={rateLabel} onChange={(event) => setRateLabel(event.target.value)} placeholder="Winter holidays" className="h-10 border border-ink/15 bg-[#fbf8f1] px-2 text-xs" /></label><label className="grid gap-1 text-[10px]">Rate per night<input required type="number" min={0} value={rateAmount} onChange={(event) => setRateAmount(event.target.value)} className="h-10 border border-ink/15 bg-[#fbf8f1] px-2 text-xs" /></label><button className="button-outline self-end !min-h-10 !px-3" disabled={busy}><Plus size={15} /> Add</button></form><div className="mt-4 grid gap-2">{seasonalRates.filter((rate) => rate.property_id === selected.id).map((rate) => <div key={rate.id} className="flex flex-wrap items-center justify-between gap-2 border border-ink/10 bg-[#fbf8f1] p-3 text-xs"><span className="font-semibold">{rate.label || "Seasonal rate"}</span><span className="text-ink/55">{rate.range}</span><span>₹{rate.nightly_rate_inr.toLocaleString("en-IN")} / night</span></div>)}{!seasonalRates.some((rate) => rate.property_id === selected.id) && <p className="text-xs text-ink/45">No seasonal rates yet.</p>}</div></div>
    </section>}</div>;
}

function textField(label: string, name: string, value: string) { return <label className="grid gap-2 text-[11px] font-semibold">{label}<input name={name} defaultValue={value} required className="h-11 border border-ink/15 bg-[#fbf8f1] px-3 text-sm font-normal outline-none focus:border-laterite" /></label>; }
function numberField(label: string, name: string, value: number) { return <label className="grid gap-2 text-[11px] font-semibold">{label}<input name={name} type="number" defaultValue={value} min={0} required className="h-11 border border-ink/15 bg-[#fbf8f1] px-3 text-sm font-normal outline-none focus:border-laterite" /></label>; }
