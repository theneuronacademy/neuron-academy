import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { AlertTriangle, CheckCircle2, Clock, Download, ExternalLink, MessageCircle, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { CopyButton, CopyPageLink, PaymentReferenceForm, RefreshStatus } from "@/components/store/OrderActions";
import { CONTACT } from "@/data/contact";
import { getDb } from "@/lib/prisma";
import { syncGatewayPayment } from "@/lib/razorpay";
import { isAccessToken, loadStoreSettings, upiPayUri } from "@/lib/store";
import { rupees } from "@/lib/displayText";

// A private page for one buyer: never cached, never indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

const STATUS_VIEW = {
  PENDING: { label: "Waiting for payment", tone: "bg-amber-50 text-amber-800 ring-amber-200", Icon: Clock },
  SUBMITTED: { label: "Payment being verified", tone: "bg-blue-50 text-blue-800 ring-blue-200", Icon: Clock },
  PAID: { label: "Paid", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", tone: "bg-silver-100 text-neutral-700 ring-silver-300", Icon: XCircle },
} as const;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ problem?: string }> }) {
  const { token } = await params;
  const { problem } = await searchParams;
  if (!isAccessToken(token)) notFound();
  const db = getDb();
  if (!db) notFound();

  const readOrder = () => db.storeOrder.findUnique({ where: { accessToken: token }, include: { book: { select: { paymentLink: true } } } });
  let order = await readOrder();
  if (!order) notFound();
  const settings = await loadStoreSettings(db);

  // Paid on Razorpay but not recorded yet (the buyer closed the payment page
  // early, or pressed "Check status")? Ask Razorpay and unlock the download.
  if (settings.gateway && order.gatewayLinkId && (order.status === "PENDING" || order.status === "SUBMITTED")) {
    const { paid } = await syncGatewayPayment(db, order);
    if (paid) order = (await readOrder()) ?? order;
  }

  const view = STATUS_VIEW[order.status];
  const amount = rupees(order.amount);
  const waiting = order.status === "PENDING" || order.status === "SUBMITTED";
  const payLink = order.book.paymentLink || settings.paymentLink;
  const upiUri = waiting ? upiPayUri(settings, order.amount, order.orderNo) : null;
  const upiQr = upiUri ? await QRCode.toDataURL(upiUri, { margin: 1, width: 440, errorCorrectionLevel: "M" }) : null;
  const placed = order.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const whatsapp = (text: string) => `${CONTACT.whatsappHref}?text=${encodeURIComponent(text)}`;

  // The ways to pay, shown in full while waiting for payment and kept
  // available (collapsed) once the buyer has reported paying.
  const howToPay = !waiting ? null : settings.gateway ? (
    <>
      <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">Pay securely with UPI, a card or net banking. Your download opens on this page as soon as the payment goes through.</p>
      <a href={`/api/store/orders/${token}/pay`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3.5 text-base font-bold text-white transition hover:bg-brand-primary-hover">
        <ShieldCheck className="h-5 w-5" aria-hidden /> Pay {amount} now
      </a>
      <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">Payments are handled by Razorpay. Already paid? Press Check status.</p>
      <div className="mt-3"><RefreshStatus /></div>
    </>
  ) : (
    <>
            {settings.instructions ? <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">{settings.instructions}</p> : null}

            {payLink ? (
              <a href={payLink} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3.5 text-base font-bold text-white transition hover:bg-brand-primary-hover">
                Pay {amount} online <ExternalLink className="h-5 w-5" aria-hidden />
              </a>
            ) : null}

            {upiUri && upiQr && settings.upiId ? (
              <div className={payLink ? "mt-6 border-t border-silver-200 pt-6" : "mt-5"}>
                <p className="text-sm font-bold text-navy-950">{payLink ? "Or pay by UPI" : "Pay by UPI"}</p>
                <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={upiQr} alt={`UPI QR code to pay ${amount}`} width={220} height={220} className="h-[220px] w-[220px] shrink-0 rounded-xl border border-silver-200 bg-white p-2" />
                  <div className="w-full text-[15px] leading-relaxed text-neutral-700">
                    <p>Scan with any UPI app (Google Pay, PhonePe, Paytm, BHIM). The amount is filled in for you.</p>
                    <a href={upiUri} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-primary px-4 py-3 text-sm font-bold text-brand-primary sm:hidden">
                      <Smartphone className="h-4 w-4" aria-hidden /> Open my UPI app
                    </a>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2"><dt className="text-neutral-600">UPI ID:</dt><dd className="font-bold text-navy-950">{settings.upiId}</dd><CopyButton text={settings.upiId} label="Copy" /></div>
                      {settings.payeeName ? <div className="flex gap-2"><dt className="text-neutral-600">Name:</dt><dd className="font-bold text-navy-950">{settings.payeeName}</dd></div> : null}
                      <div className="flex gap-2"><dt className="text-neutral-600">Amount:</dt><dd className="font-bold text-navy-950">{amount}</dd></div>
                      <div className="flex gap-2"><dt className="text-neutral-600">Note:</dt><dd className="font-bold text-navy-950">Order {order.orderNo}</dd></div>
                    </dl>
                  </div>
                </div>
              </div>
            ) : null}

            {!payLink && !upiUri ? (
              <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">Please message the academy on WhatsApp for payment details.</p>
            ) : null}
    </>
  );

  const problems: Record<string, string> = {
    file: "The file could not be opened just now. Please message the academy and we will send it to you.",
    server: "Something went wrong opening the file. Please try again in a minute.",
    pay: "The payment page could not be opened just now. Please try again in a minute.",
    busy: "Too many attempts. Please wait a few minutes and try again.",
    unpaid: "We could not confirm a payment for this order. If money left your account, press Check status in a minute, or message the academy.",
  };
  const problemText = order.status !== "PAID" || problem === "file" || problem === "server" ? problems[problem ?? ""] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-[12px] font-bold tracking-[0.16em] text-brand-primary">YOUR ORDER</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-950 sm:text-3xl">{order.orderNo}</h1>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ring-1 ${view.tone}`}>
            <view.Icon className="h-4 w-4" aria-hidden /> {view.label}
          </span>
        </div>

        {/* Summary */}
        <dl className="mt-6 divide-y divide-silver-200 rounded-2xl border border-silver-200 bg-white px-5 text-[15px] shadow-sm">
          <div className="flex justify-between gap-4 py-3.5"><dt className="text-neutral-600">Item</dt><dd className="text-right font-bold text-navy-950">{order.bookTitle}</dd></div>
          <div className="flex justify-between gap-4 py-3.5"><dt className="text-neutral-600">Amount</dt><dd className="font-extrabold text-navy-950">{amount}</dd></div>
          <div className="flex justify-between gap-4 py-3.5"><dt className="text-neutral-600">Name</dt><dd className="text-right font-bold text-navy-950">{order.buyerName}</dd></div>
          <div className="flex justify-between gap-4 py-3.5"><dt className="text-neutral-600">Ordered</dt><dd className="text-right font-bold text-navy-950">{placed}</dd></div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-primary/5 px-4 py-3 text-[13px] leading-relaxed text-navy-950">
          <span className="flex-1">Keep this page&apos;s link. It is how you return to this order and to your download.</span>
          <CopyPageLink />
        </div>

        {problemText ? (
          <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {problemText}
          </p>
        ) : null}

        {/* PAID — download */}
        {order.status === "PAID" ? (
          <section className="mt-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy-950"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden /> Payment confirmed</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">Thank you. Your study material is ready.</p>
            <a href={`/api/store/orders/${token}/download`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3.5 text-base font-bold text-white transition hover:bg-brand-primary-hover">
              <Download className="h-5 w-5" aria-hidden /> Download PDF
            </a>
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">You can come back to this page and download again. The file is for your own study; please do not share it.</p>
          </section>
        ) : null}

        {/* PENDING — step 1: pay */}
        {order.status === "PENDING" ? (
          <section className="mt-8 rounded-2xl border border-silver-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-navy-950">{settings.gateway ? `Pay ${amount}` : `Step 1: Pay ${amount}`}</h2>
            {howToPay}
          </section>
        ) : null}

        {order.status === "PENDING" && !settings.gateway ? (
          <section className="mt-6 rounded-2xl border border-silver-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-navy-950">Step 2: Tell us you have paid</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">After paying, enter the transaction number so the academy can match your payment.</p>
            <div className="mt-4"><PaymentReferenceForm token={token} /></div>
          </section>
        ) : null}

        {order.status === "SUBMITTED" ? (
          <section className="mt-8 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy-950"><Clock className="h-5 w-5 text-blue-700" aria-hidden /> We are checking your payment</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
              You reported transaction <span className="font-bold text-navy-950">{order.paymentRef}</span>. Once the academy confirms it, the download button appears on this page.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <RefreshStatus />
              <a href={whatsapp(`Hello, I have paid ${amount} for order ${order.orderNo} (${order.bookTitle}). Transaction number: ${order.paymentRef}. Please confirm.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white">
                <MessageCircle className="h-4 w-4" aria-hidden /> Tell the academy on WhatsApp
              </a>
            </div>
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer font-bold text-brand-primary">Entered the wrong number?</summary>
              <div className="mt-4"><PaymentReferenceForm token={token} current={order.paymentRef} /></div>
            </details>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-bold text-brand-primary">Show the payment details again</summary>
              <div className="mt-2">{howToPay}</div>
            </details>
          </section>
        ) : null}

        {order.status === "CANCELLED" ? (
          <section className="mt-8 rounded-2xl border border-silver-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-navy-950">This order was cancelled</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">If you have paid for it, or think this is a mistake, please message the academy with your order number.</p>
            <Link href="/store" className="mt-4 inline-flex text-sm font-bold text-brand-primary underline-offset-4 hover:underline">Back to the store</Link>
          </section>
        ) : null}

        <p className="mt-8 text-center text-[13px] leading-relaxed text-neutral-600">
          Need help? WhatsApp or call {CONTACT.phone} and quote order {order.orderNo}.{" "}
          <a href={whatsapp(`Hello, I need help with order ${order.orderNo}.`)} target="_blank" rel="noreferrer" className="font-bold text-brand-primary underline-offset-4 hover:underline">Message us</a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
