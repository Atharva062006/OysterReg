import { NextRequest, NextResponse } from "next/server";
import { getEventById } from "@/lib/firebase";

/**
 * Resolves the correct registration fee from the event config.
 * This MUST run server-side — never trust a price sent from the client.
 *
 * - pricingType === "dynamic": finds the option whose value === selectedOptionValue
 *   in the field identified by event.pricingFieldId and returns its price.
 * - pricingType === "fixed" (or omitted): returns event.registrationFee.
 */
function resolveEventPrice(event: any, selectedOptionValue?: string): number {
  if (!event.razorpayEnabled) return 0;

  if (event.pricingType === "dynamic" && event.pricingFieldId) {
    const pricingField = (event.formSchema ?? []).find(
      (f: any) => f.id === event.pricingFieldId
    );

    if (!pricingField || !Array.isArray(pricingField.options)) {
      throw new Error("Pricing configuration error: the pricing field is missing or has no options.");
    }

    const matchedOption = pricingField.options.find(
      (opt: any) => opt.value === selectedOptionValue
    );

    if (!matchedOption) {
      throw new Error(`Invalid selection "${selectedOptionValue}" for pricing field "${pricingField.label}".`);
    }

    if (typeof matchedOption.price !== "number" || matchedOption.price <= 0) {
      throw new Error(`No price is configured for the "${matchedOption.label}" option.`);
    }

    return matchedOption.price;
  }

  // Fixed / flat fee fallback
  return event.registrationFee ?? 0;
}

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

    const body = await request.json();
    const { eventId, selectedOption, receipt, notes } = body;

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId." }, { status: 400 });
    }

    // Fetch event from Firestore to verify registration fee securely on the server
    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (!event.razorpayEnabled) {
      return NextResponse.json(
        { error: "This event does not require payment." },
        { status: 400 }
      );
    }

    // Resolve final fee securely — client-supplied amount is IGNORED
    let finalFee: number;
    try {
      finalFee = resolveEventPrice(event, selectedOption);
    } catch (priceErr: any) {
      return NextResponse.json({ error: priceErr.message }, { status: 400 });
    }

    if (finalFee <= 0) {
      return NextResponse.json(
        { error: "No valid fee resolved for this event/selection." },
        { status: 400 }
      );
    }

    // Amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(finalFee * 100);

    // Call Razorpay Orders REST API
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: receipt || `rcpt_${eventId.slice(0, 10)}_${Date.now()}`,
        notes: {
          eventId,
          eventName: event.name,
          ...(selectedOption ? { selectedOption } : {}),
          ...notes,
        },
      }),
    });

    if (!rzpResponse.ok) {
      const errorData = await rzpResponse.json();
      console.error("Razorpay order creation failed:", errorData);
      return NextResponse.json(
        { error: errorData?.error?.description || "Failed to create Razorpay order." },
        { status: rzpResponse.status }
      );
    }

    const order = await rzpResponse.json();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      // Echo back the resolved fee in rupees so the client can show it accurately
      resolvedFee: finalFee,
    });
  } catch (err: any) {
    console.error("Error creating Razorpay order:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
