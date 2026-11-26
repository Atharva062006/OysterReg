import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { collection, doc, getDocs, query, where, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * POST /api/razorpay/webhook-v1
 *
 * Server-side Razorpay webhook handler for `payment.captured` and `order.paid`.
 * Ensures that even if a user's mobile browser suspends or drops during UPI
 * app-switching, Razorpay's server updates Firestore to `paymentStatus: "paid"`.
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "RAZORPAY_WEBHOOK_SECRET is not configured." },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event || "";

    if (eventType !== "payment.captured" && eventType !== "order.paid") {
      return NextResponse.json({ received: true, ignored: eventType });
    }

    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const paymentId: string | undefined = paymentEntity?.id;
    const orderId: string | undefined = paymentEntity?.order_id || orderEntity?.id;
    const amountPaise: number | undefined = paymentEntity?.amount ?? orderEntity?.amount_paid;
    const notes = {
      ...(orderEntity?.notes || {}),
      ...(paymentEntity?.notes || {}),
    };

    const eventId: string | undefined = notes.eventId;
    const docId: string | undefined = notes.docId;

    if (!eventId) {
      return NextResponse.json({ received: true, warning: "No eventId in notes" });
    }

    const targetCollection =
      eventId === "recruitment-2026"
        ? collection(db, "registrations")
        : collection(db, "events", eventId, "registrations");

    const paymentUpdate = {
      paymentStatus: "paid" as const,
      ...(orderId ? { razorpayOrderId: orderId } : {}),
      ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
      ...(typeof amountPaise === "number" ? { paymentAmount: Math.round(amountPaise / 100) } : {}),
    };

    if (docId) {
      await setDoc(doc(targetCollection, docId), paymentUpdate, { merge: true });
      return NextResponse.json({ received: true, updatedDocId: docId });
    }

    // Fallback: look up by razorpayOrderId if docId wasn't in notes
    if (orderId) {
      const q = query(targetCollection, where("razorpayOrderId", "==", orderId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await setDoc(doc(targetCollection, d.id), paymentUpdate, { merge: true });
      }
      return NextResponse.json({ received: true, matchedDocs: snap.size });
    }

    return NextResponse.json({ received: true, warning: "No docId or orderId to match" });
  } catch (err: any) {
    console.error("Error handling Razorpay webhook:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
