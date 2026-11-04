"use client";

import { useState } from "react";
import { CircleDollarSign, LoaderCircle, RotateCcw } from "lucide-react";

type Payment = { id: string; booking_id: string; razorpay_order_id: string; razorpay_payment_id: string | null; status: string; amount_inr: number; refunded_inr: number; method: string | null; created_at: string };
type Booking = { id: string; guest_id_name: string; properties: { name: string } | null; checkin_date: string; checkout_date: string };

export function AdminPayments({ payments, bookings }: { payments: Payment[]; bookings: Booking[] }) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function refund(payment: Payment) {
    const amountInr = Number(amounts[payment.id] || payment.amount_inr);
    setBusyId(payment.id); setNotice(""); setError("");
    const response = await fetch("/api/admin/payments/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: payment.id, amountInr, reason: reasons[payment.id] || "Owner-initiated refund" }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setNotice(`Refund ${result.refundId} requested. Razorpay will report its final status by webhook.`);
    else setError(result.error ?? "Refund could not be requested.");
    setBusyId(null);
  }
  return <div><div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Payment records" value={payments.length} /><Metric label="Captured amount" value={`₹${payments.filter((payment) => ["captured", "partially_refunded", "refund_pending"].includes(payment.status)).reduce((sum, payment) => sum + payment.amount_inr - payment.refunded_inr, 0).toLocaleString("en-IN")}`} /><Metric label="Awaiting webhook" value={payments.filter((payment) => payment.status === "authorized" || payment.status === "refund_pending").length} /></div>{notice && <p role="status" className="mb-4 text-xs text-lagoon">{notice}</p>}{error && <p role="alert" className="mb-4 text-xs text-laterite">{error}</p>}<div className="grid gap-3">{payments.map((payment) => { const booking = bookings.find((item) => item.id === payment.booking_id); const refundable = payment.razorpay_payment_id && ["captured", "partially_refunded"].includes(payment.status); const remaining = payment.amount_inr - payment.refunded_inr; return <article key={payment.id} className="grid gap-4 border border-ink/10 bg-[#fbf8f1] p-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center bg-[#e9e1d2] text-laterite"><CircleDollarSign size={17} /></span><div><p className="font-display text-xl">{booking?.properties?.name ?? "Stay payment"}</p><p className="mt-1 text-xs text-ink/55">{booking?.guest_id_name ?? "Guest"} · {booking?.checkin_date} → {booking?.checkout_date}</p><p className="mt-2 font-mono text-[10px] text-ink/40">{payment.razorpay_payment_id ?? payment.razorpay_order_id}</p></div></div></div><div className="flex flex-wrap items-center gap-3 lg:justify-end"><div className="text-right"><p className="font-display text-2xl">₹{payment.amount_inr.toLocaleString("en-IN")}</p><p className="text-[10px] uppercase tracking-widest text-ink/45">{payment.status}{payment.method ? ` · ${payment.method}` : ""}</p>{payment.refunded_inr > 0 && <p className="text-[10px] text-laterite">₹{payment.refunded_inr.toLocaleString("en-IN")} refunded</p>}</div>{refundable && <div className="flex flex-wrap items-end gap-2 border-l border-ink/10 pl-3"><label className="grid gap-1 text-[9px]">Amount (₹)<input type="number" min={1} max={remaining} value={amounts[payment.id] ?? remaining} onChange={(event) => setAmounts((state) => ({ ...state, [payment.id]: event.target.value }))} className="h-9 w-24 border border-ink/15 bg-paper px-2 text-xs" /></label><label className="grid gap-1 text-[9px]">Reason<input value={reasons[payment.id] ?? ""} onChange={(event) => setReasons((state) => ({ ...state, [payment.id]: event.target.value }))} placeholder="Optional" className="h-9 w-32 border border-ink/15 bg-paper px-2 text-xs" /></label><button onClick={() => void refund(payment)} disabled={busyId === payment.id} className="button-outline !min-h-9 !px-2 !text-[10px]">{busyId === payment.id ? <LoaderCircle size={13} className="animate-spin" /> : <RotateCcw size={13} />} Refund</button></div>}</div></article>; })}{payments.length === 0 && <p className="border border-dashed border-ink/20 p-8 text-center text-xs text-ink/50">No payment records yet.</p>}</div></div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <article className="border border-ink/10 bg-[#fbf8f1] p-4"><p className="eyebrow text-ink/45">{label}</p><p className="mt-2 font-display text-3xl">{value}</p></article>; }
