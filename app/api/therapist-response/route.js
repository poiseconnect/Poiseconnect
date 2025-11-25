// app/api/therapist-response/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey)
    : null;

// Basis-URL deiner App (Vercel-Deployment)
const FRONTEND_BASE = "https://poiseconnect.vercel.app";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const action = searchParams.get("action") || "";
    const client = searchParams.get("client") || "";
    const therapist = searchParams.get("therapist") || "";
    const terminIso = searchParams.get("termin") || "";

    console.log("Therapist response:", action, client, therapist, terminIso);

    // --- A) Termin bestätigen: in Supabase eintragen ---
    if (action === "confirm") {
      if (supabase && client && therapist && terminIso) {
        const { error } = await supabase
          .from("confirmed_appointments")
          .insert({
            therapist,
            client_email: client,
            termin_iso: terminIso,
          });

        if (error) {
          console.error("Supabase insert error:", error);
        }
      } else {
        console.warn(
          "Supabase oder Daten fehlen bei confirm",
          !!supabase,
          client,
          therapist,
          terminIso
        );
      }

      const target = `${FRONTEND_BASE}/?resume=confirmed&email=${encodeURIComponent(
        client
      )}`;
      return NextResponse.redirect(target);
    }

    // --- B) Neuer Termin, gleiche Begleitung ---
    if (action === "rebook_same") {
      const target =
        `${FRONTEND_BASE}/?resume=10` +
        `&email=${encodeURIComponent(client)}` +
        `&therapist=${encodeURIComponent(therapist)}`;
      return NextResponse.redirect(target);
    }

    // --- C) Anderes Teammitglied wählen ---
    if (action === "rebook_other") {
      const target =
        `${FRONTEND_BASE}/?resume=5` +
        `&email=${encodeURIComponent(client)}`;
      return NextResponse.redirect(target);
    }

    // Fallback: unbekannte Aktion
    return NextResponse.json(
      { ok: false, error: "UNKNOWN_ACTION", action },
      { status: 400 }
    );
  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
