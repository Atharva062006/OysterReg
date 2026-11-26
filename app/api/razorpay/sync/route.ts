import { NextRequest, NextResponse } from "next/server";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db, Registration } from "@/lib/firebase";

/**
 * POST /api/razorpay/sync
 * Body: { eventId: string }
 *
 * Checks every "pending" or "failed" registration in Firestore for the given event
 * against Razorpay's Orders Payments API. Any order with a "captured" payment is
 * automatically flipped to paymentStatus: "paid" in Firestore.
 */
export async function POST(request: NextRequest) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay API credentials are not configured on the server." },
        { status: 500 }
      );
    }

    const { eventId } = await request.json();
    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId." }, { status: 400 });
    }

    const targetCollection =
      eventId === "recruitment-2026"
        ? collection(db, "registrations")
        : collection(db, "events", eventId, "registrations");

    const snapshot = await getDocs(targetCollection);
    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    let checked = 0;
    let markedPaid = 0;
    let markedFailed = 0;
    const updatedIds: string[] = [];

    for (const d of snapshot.docs) {
      const reg = d.data() as Registration;
      if (reg.paymentStatus !== "pending" && reg.paymentStatus !== "failed") {
        continue;
      }
      if (!reg.razorpayOrderId) {
        continue;
      }

      checked++;
      try {
        const res = await fetch(
          `https://api.razorpay.com/v1/orders/${encodeURIComponent(reg.razorpayOrderId)}/payments`,
          {
            headers: { Authorization: authHeader },
          }
        );

        if (!res.ok) continue;
        const data = await res.json();
        const payments: any[] = data.items || [];

        const captured = payments.find((p) => p.status === "captured");
        if (captured) {
          const ref = doc(targetCollection, d.id);
          await setDoc(
            ref,
            {
              paymentStatus: "paid",
              razorpayPaymentId: captured.id,
              paymentAmount:
                typeof captured.amount === "number"
                  ? Math.round(captured.amount / 100)
                  : reg.paymentAmount,
            },
            { merge: true }
          );
          markedPaid++;
          updatedIds.push(d.id);
        } else if (
          reg.paymentStatus === "pending" &&
          payments.length > 0 &&
          payments.every((p) => p.status === "failed")
        ) {
          const ref = doc(targetCollection, d.id);
          await setDoc(ref, { paymentStatus: "failed" }, { merge: true });
          markedFailed++;
        }
      } catch (err) {
        console.error(`Failed to sync order ${reg.razorpayOrderId}:`, err);
      }
    }

    return NextResponse.json({
      checked,
      markedPaid,
      markedFailed,
      updatedIds,
    });
  } catch (err: any) {
    console.error("Error syncing Razorpay payments:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
