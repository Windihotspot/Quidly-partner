
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!paystackSecret) {
      throw new Error("Paystack secret is missing");
    }

    // Authenticate customer.
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return response({ error: "Authentication required" }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return response({ error: "Invalid session" }, 401);
    }

    const { reference } = await req.json();

    if (
      typeof reference !== "string" ||
      !/^TKT-[a-f0-9-]{36}$/i.test(reference)
    ) {
      return response({ error: "Invalid payment reference" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Confirm transaction belongs to this customer.
    const { data: transaction, error: lookupError } = await admin
      .from("transactions")
      .select("id, reference, customer_user_id, status")
      .eq("reference", reference)
      .maybeSingle();

    if (lookupError || !transaction) {
      return response({ error: "Transaction not found" }, 404);
    }

    if (transaction.customer_user_id !== user.id) {
      return response({ error: "You cannot verify this transaction" }, 403);
    }

    if (transaction.status === "completed") {
      return response({
        success: true,
        message: "Payment already confirmed",
      });
    }

    // Verify directly with Paystack.
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
        },
      },
    );

    const result = await paystackResponse.json();

    if (!paystackResponse.ok || !result.status) {
      return response({ error: "Unable to verify payment" }, 502);
    }

    const payment = result.data;

    if (payment.reference !== reference) {
      return response({ error: "Reference mismatch" }, 400);
    }

    if (payment.status !== "success") {
      return response({
        success: false,
        payment_status: payment.status,
        message: "Payment has not been confirmed",
      });
    }

    if (payment.domain !== "test" && payment.domain !== "live") {
      return response({ error: "Invalid payment environment" }, 400);
    }

    // The shared database function validates amount/currency
    // and issues tickets exactly once.
    const { data: completion, error: completionError } =
      await admin.rpc("complete_ticket_payment", {
        p_reference: reference,
        p_gateway_reference: String(payment.id),
        p_amount_kobo: payment.amount,
        p_currency: payment.currency,
      });

    if (completionError) {
      console.error("Payment completion:", completionError);
      return response({
        error: "Payment received but ticket fulfillment needs attention",
      }, 500);
    }

    return response({
      success: true,
      message: "Payment verified successfully",
      completion,
    });
  } catch (error) {
    console.error("Verify payment:", error);

    return response({
      error: "Payment verification failed",
    }, 500);
  }
});
