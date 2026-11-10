
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}

async function verifySignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body),
  );

  return safeEqual(toHex(digest), signature.toLowerCase());
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!paystackSecret || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Webhook configuration is incomplete");
    }

    // Read the original raw request body.
    const rawBody = await req.text();

    const signature = req.headers.get("x-paystack-signature");

    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const validSignature = await verifySignature(
      rawBody,
      signature,
      paystackSecret,
    );

    if (!validSignature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // Acknowledge events we don't process.
    if (event.event !== "charge.success") {
      return Response.json({ received: true });
    }

    const reference = event.data?.reference;

    if (!reference) {
      return new Response("Missing reference", { status: 400 });
    }

    // Never trust the webhook payload alone.
    // Verify the transaction directly with Paystack.
    const verificationResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
        },
      },
    );

    const verification = await verificationResponse.json();

    if (
      !verificationResponse.ok ||
      !verification.status ||
      verification.data?.status !== "success" ||
      verification.data?.reference !== reference
    ) {
      console.error("Paystack verification failed:", verification);
      return new Response("Payment not verified", { status: 400 });
    }

    const payment = verification.data;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: completion, error } = await admin.rpc(
      "complete_ticket_payment",
      {
        p_reference: reference,
        p_gateway_reference: String(payment.id),
        p_amount_kobo: payment.amount,
        p_currency: payment.currency,
      },
    );

    if (error) {
      console.error("Ticket fulfillment failed:", error);

      // Non-2xx tells Paystack to retry delivery.
      return new Response("Fulfillment failed", { status: 500 });
    }

    console.log("Payment processed:", reference, completion);

    return Response.json({
      received: true,
      success: true,
    });
  } catch (error) {
    console.error("Paystack webhook error:", error);

    return new Response("Webhook processing failed", {
      status: 500,
    });
  }
});
