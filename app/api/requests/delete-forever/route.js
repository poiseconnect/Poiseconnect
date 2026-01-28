import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "missing_requestId" }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .delete()
      .eq("id", requestId);

    if (error) {
      console.error("DELETE ERROR:", error);
      return new Response(
        JSON.stringify({ error: "db_delete_failed" }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("DELETE SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500 }
    );
  }
}
