
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (data: unknown, status = 200) =>
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
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const callbackUrl = Deno.env.get("PAYSTACK_CALLBACK_URL");

    if (!paystackSecret || !callbackUrl) {
      throw new Error("Payment configuration is incomplete");
    }

    // Authenticate the customer.
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user || !user.email) {
      return jsonResponse({ error: "Invalid user session" }, 401);
    }

    // Admin client: database operations happen server-side.
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const body = await req.json();

    const {
      ticket_type_id,
      quantity,
      customer_name,
      customer_phone,
    } = body;

    if (
      !ticket_type_id ||
      !Number.isInteger(quantity) ||
      !customer_name?.trim() ||
      quantity < 1 ||
      quantity > 5
    ) {
      return jsonResponse({ error: "Invalid checkout details" }, 400);
    }

    // Generate a unique Paystack reference.
    const reference = `TKT-${crypto.randomUUID()}`;

    // Create pending transaction using the database function.
    const { data: transaction, error: transactionError } =
      await supabaseAdmin.rpc(
        "create_pending_ticket_transaction",
        {
          p_ticket_type_id: ticket_type_id,
          p_quantity: quantity,
          p_customer_name: customer_name.trim(),
          p_customer_email: user.email,
          p_customer_phone: customer_phone || null,
          p_customer_user_id: user.id,
          p_reference: reference,
        },
      );

    if (transactionError || !transaction) {
      console.error("Transaction creation:", transactionError);

      return jsonResponse({
        error: transactionError?.message || "Unable to create transaction",
      }, 400);
    }

    // Convert naira to kobo.
    const amountInKobo = Math.round(
      Number(transaction.amount) * 100,
    );

    if (!Number.isSafeInteger(amountInKobo) || amountInKobo < 5000) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed", failed_reason: "Invalid amount" })
        .eq("id", transaction.transaction_id);

      return jsonResponse({ error: "Invalid payment amount" }, 400);
    }

    // Initialize Paystack checkout.
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          amount: amountInKobo,
          currency: transaction.currency,
          reference,
          callback_url: callbackUrl,
          metadata: {
            transaction_id: transaction.transaction_id,
            ticket_type_id,
            quantity,
          },
        }),
      },
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "failed",
          failed_reason: paystackData.message || "Paystack initialization failed",
        })
        .eq("id", transaction.transaction_id);

      return jsonResponse({
        error: "Unable to initialize Paystack payment",
      }, 502);
    }

    return jsonResponse({
      success: true,
      message: "Payment initialized",
      authorization_url: paystackData.data.authorization_url,
      reference,
      transaction_id: transaction.transaction_id,
    });
  } catch (error) {
    console.error("Initialize payment error:", error);

    return jsonResponse({
      error: error instanceof Error
        ? error.message
        : "Something went wrong",
    }, 500);
  }
});
