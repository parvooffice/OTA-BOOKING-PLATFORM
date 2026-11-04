import PDFDocument from "pdfkit";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InvoiceDetails = {
  id: string; created_at: string; checkin_date: string; checkout_date: string; guests: number;
  subtotal_inr: number; taxes_inr: number; total_inr: number; amount_paid_inr: number;
  guestName: string; guestPhone: string; guestEmail: string; propertyName: string; district: string;
  legalName?: string; gstin?: string; legalAddress?: string; gstPercent?: number;
};

export async function createInvoicePdf(booking: InvoiceDetails) {
  const document = new PDFDocument({ size: "A4", margin: 54, info: { Title: `Odisha Retreat invoice ${booking.id}`, Author: "Odisha Retreat" } });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  const rupees = (amount: number) => `INR ${amount.toLocaleString("en-IN")}`;
  document.fillColor("#a64d37").font("Times-Bold").fontSize(25).text("Odisha Retreat");
  document.fillColor("#645a51").font("Helvetica").fontSize(9).text("A privately hosted stay in Odisha, India");
  if (booking.legalName || booking.gstin || booking.legalAddress) document.text([booking.legalName, booking.gstin ? `GSTIN ${booking.gstin}` : "", booking.legalAddress].filter(Boolean).join(" · "));
  document.moveDown(2);
  document.fillColor("#2a211a").font("Times-Bold").fontSize(19).text("Tax invoice / booking receipt");
  document.moveDown(.5);
  document.font("Helvetica").fontSize(9).fillColor("#645a51").text(`Invoice: OR-${booking.id.slice(0, 8).toUpperCase()}`);
  document.text(`Issued: ${new Date(booking.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}`);
  document.moveDown(1.5);
  document.fillColor("#2a211a").font("Helvetica-Bold").text("Guest");
  document.font("Helvetica").text(booking.guestName || booking.guestEmail).text(booking.guestPhone).text(booking.guestEmail);
  document.moveDown(.8);
  document.font("Helvetica-Bold").text("Stay");
  document.font("Helvetica").text(`${booking.propertyName} · ${booking.district}, Odisha`);
  document.text(`${booking.checkin_date} to ${booking.checkout_date} · ${booking.guests} guest${booking.guests === 1 ? "" : "s"}`);
  document.moveDown(1.7);
  const left = 58; const right = 536;
  const line = (label: string, value: string, y = document.y) => { document.moveTo(left, y).lineTo(right, y).strokeColor("#e2d9cb").stroke(); document.fillColor("#2a211a").font("Helvetica").fontSize(10).text(label, left, y + 12); document.font("Helvetica-Bold").text(value, left, y + 12, { width: right - left, align: "right" }); return y + 42; };
  let y = document.y;
  y = line("Accommodation and cleaning", rupees(booking.subtotal_inr), y);
  y = line(`GST included${booking.gstPercent !== undefined ? ` (${booking.gstPercent}%)` : ""}`, rupees(booking.taxes_inr), y);
  y = line("Booking total", rupees(booking.total_inr), y);
  line("Paid to date", rupees(booking.amount_paid_inr), y);
  document.moveDown(4);
  document.fillColor("#7a7066").font("Helvetica").fontSize(8).text("GST is included as configured by the property owner. Consult your accountant before issuing production invoices.", left, document.y, { width: right - left, lineGap: 3 });
  document.moveDown(1.5);
  document.fillColor("#a64d37").font("Times-Italic").fontSize(14).text("Thank you for staying a little closer to Odisha.");
  document.end();
  return completed;
}

export async function sendBookingConfirmation(service: SupabaseClient, bookingId: string) {
  if (!process.env.RESEND_API_KEY) return;
  const { data: booking } = await service.from("bookings").select("id,guest_id,guest_id_name,guest_phone,created_at,checkin_date,checkout_date,guests,subtotal_inr,taxes_inr,total_inr,amount_paid_inr,properties(name,district)").eq("id", bookingId).maybeSingle();
  if (!booking) return;
  const [{ data: guestResult }, { data: settings }] = await Promise.all([
    service.auth.admin.getUserById(booking.guest_id),
    service.from("admin_settings").select("key,value").in("key", ["invoice_legal_name", "invoice_gstin", "invoice_address", "gst_percent"])
  ]);
  const guestEmail = guestResult.user?.email;
  if (!guestEmail) return;
  const property = booking.properties as unknown as { name: string; district: string } | null;
  const settingsMap = Object.fromEntries((settings ?? []).map((item) => [item.key, item.value]));
  const detail: InvoiceDetails = { ...booking, guestName: booking.guest_id_name, guestPhone: booking.guest_phone, guestEmail, propertyName: property?.name ?? "Odisha Retreat stay", district: property?.district ?? "Odisha", legalName: String(settingsMap.invoice_legal_name ?? ""), gstin: String(settingsMap.invoice_gstin ?? ""), legalAddress: String(settingsMap.invoice_address ?? ""), gstPercent: Number(settingsMap.gst_percent ?? 5) };
  const invoice = await createInvoicePdf(detail);
  const from = process.env.BOOKING_FROM_EMAIL || "Odisha Retreat <bookings@odisharetreat.com>";
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from, to: guestEmail, subject: `Your stay is confirmed · Odisha Retreat`,
    ...(process.env.BOOKING_REPLY_TO ? { replyTo: process.env.BOOKING_REPLY_TO } : {}),
    html: `<p>Dear ${escapeHtml(detail.guestName || "guest")},</p><p>Your dates at ${escapeHtml(detail.propertyName)} are confirmed. We’ll be in touch with the arrival details closer to your stay.</p><p><strong>${detail.checkin_date} to ${detail.checkout_date}</strong></p><p>Guest mobile: ${escapeHtml(detail.guestPhone)}</p><p>Paid: INR ${detail.amount_paid_inr.toLocaleString("en-IN")} · Booking total: INR ${detail.total_inr.toLocaleString("en-IN")}</p><p>Warmly,<br>Your host at Odisha Retreat</p>`,
    attachments: [{ filename: `Odisha-Retreat-invoice-${bookingId.slice(0, 8)}.pdf`, content: invoice }]
  });
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
