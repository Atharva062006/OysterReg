import { NextResponse } from "next/server";

/**
 * Deprecated webhook endpoint — replaced by /api/razorpay/webhook-v1.
 * Returns 200 OK so any legacy Razorpay webhook pointing here does not
 * trigger failure retries or alert emails.
 */
export async function POST() {
  return NextResponse.json({ received: true, deprecated: true });
}
