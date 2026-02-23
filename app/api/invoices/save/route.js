import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const body = await req.json();

  const { id, ...invoiceData } = body;

  const { data, error } = await supabase
    .from("invoices")
    .upsert(
      {
        id: id || undefined,
        ...invoiceData,
        updated_at: new Date()
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
    });
  }

  return new Response(JSON.stringify({ data }), { status: 200 });
}
