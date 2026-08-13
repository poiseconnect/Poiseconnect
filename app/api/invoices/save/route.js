import {
  json,
  getUserFromBearer,
  supabaseAdmin,
} from "../../_lib/server";

export async function POST(req) {
  const { user, error: authError } = await getUserFromBearer(req);
  if (!user) {
    return json({ error: authError || "NO_TOKEN" }, 401);
  }

  const sb = supabaseAdmin();

  const { data: member, error: memberErr } = await sb
    .from("team_members")
    .select("id, role, active")
    .eq("user_id", user.id)
    .single();

  if (memberErr || !member || member.active !== true) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const isAdmin = member.role === "admin";
  const isTherapist = member.role === "therapist";

  if (!isAdmin && !isTherapist) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const body = await req.json();
  const { id, therapist_id, ...invoiceData } = body;

  try {
    let invoicePayload = {
      ...invoiceData,
      updated_at: new Date(),
    };

    if (id) {
      const { data: existingInvoice, error: existingInvoiceErr } = await sb
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (existingInvoiceErr || !existingInvoice) {
        return json({ error: "INVOICE_NOT_FOUND" }, 404);
      }

      if (
        isTherapist &&
        String(existingInvoice.therapist_id) !== String(member.id)
      ) {
        return json({ error: "NO_ACCESS" }, 403);
      }

      invoicePayload = {
        ...invoicePayload,
        therapist_id: existingInvoice.therapist_id,
      };
    } else {
      const anfrageId = String(invoiceData.anfrage_id || "");

      if (!anfrageId) {
        return json({ error: "MISSING_ANFRAGE_ID" }, 400);
      }

      const { data: anfrage, error: anfrageErr } = await sb
        .from("anfragen")
        .select("id, assigned_therapist_id")
        .eq("id", anfrageId)
        .single();

      if (anfrageErr || !anfrage) {
        return json({ error: "ANFRAGE_NOT_FOUND" }, 404);
      }

      if (
        isTherapist &&
        String(anfrage.assigned_therapist_id) !== String(member.id)
      ) {
        return json({ error: "NO_ACCESS" }, 403);
      }

      invoicePayload = {
        ...invoicePayload,
        therapist_id: anfrage.assigned_therapist_id || null,
      };
    }

    const { data, error } = await sb
      .from("invoices")
      .upsert(
        {
          id: id || undefined,
          ...invoicePayload,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ data }, 200);
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
