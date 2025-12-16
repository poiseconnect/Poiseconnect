"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------
// STATUS-NORMALISIERUNG
// ---------------------------------------------------------
function normalizeStatus(raw) {
  if (!raw) return "offen";

  let s = String(raw).toLowerCase().trim();
  s = s.replace(/['"]+/g, "").replace("::text", "").trim();

  if (["neu", "new", "offen", ""].includes(s)) return "offen";
  if (["termin_neu", "new_appointment"].includes(s)) return "termin_neu";
  if (["termin_bestaetigt", "confirmed"].includes(s)) return "termin_bestaetigt";
  if (["weitergeleitet", "forwarded"].includes(s)) return "weitergeleitet";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["beendet", "finished", "closed"].includes(s)) return "beendet";
  if (["kein_match", "nomatch", "no_match"].includes(s)) return "kein_match";

  return "offen";
}

const STATUS_META = {
  offen: { label: "Neu", bg: "#FFF7EC", border: "#E3C29A", text: "#8B5A2B" },
  termin_neu: { label: "Neuer Termin", bg: "#EFF3FF", border: "#9AAAF5", text: "#304085" },
  termin_bestaetigt: { label: "Termin bestätigt", bg: "#EAF8EF", border: "#9AD0A0", text: "#2F6E3A" },
  weitergeleitet: { label: "Weitergeleitet", bg: "#F4EFFF", border: "#C9B0FF", text: "#5E3EA8" },
  active: { label: "Begleitung aktiv", bg: "#E8FFF0", border: "#90D5A0", text: "#2D7A45" },
  kein_match: { label: "Kein Match", bg: "#FFECEC", border: "#F2A5A5", text: "#9B1C2C" },
  beendet: { label: "Beendet", bg: "#F0F0F0", border: "#CCCCCC", text: "#666" },
};

// ---------------------------------------------------------
// MODAL
// ---------------------------------------------------------
function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------
export default function DashboardFull() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessionsByRequest, setSessionsByRequest] = useState({});
  const [filter, setFilter] = useState("unbearbeitet");
  const [loading, setLoading] = useState(true);

  const [matchModal, setMatchModal] = useState(null);
  const [matchTarif, setMatchTarif] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchDuration, setMatchDuration] = useState(60);

  const [sessionModal, setSessionModal] = useState(null);
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  // 🔹 DETAILANSICHT
  const [detailsModal, setDetailsModal] = useState(null);

  // Tarif
  const [editTarif, setEditTarif] = useState("");

  // Sitzungen (Batch)
  const [newSessions, setNewSessions] = useState([
    { date: "", duration: 60 },
  ]);

  // ---------------------------------------------------------
  // USER LADEN
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // ---------------------------------------------------------
  // ANFRAGEN LADEN
  // ---------------------------------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);
      const email = user.email.toLowerCase();
      const isAdmin = email === "hallo@mypoise.de";

      let query = supabase
        .from("anfragen")
        .select(`
          id,
          created_at,
          vorname,
          nachname,
          email,
          anliegen,
          status,
          bevorzugte_zeit,
          wunschtherapeut,
          honorar_klient
        `)
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data } = await query;

      setRequests(
        (data || []).map((r) => ({
          ...r,
          _status: normalizeStatus(r.status),
        }))
      );

      setLoading(false);
    }

    load();
  }, [user]);

  // ---------------------------------------------------------
  // SESSIONS LADEN
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadSessions() {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .order("date", { ascending: true });

      const grouped = {};
      (data || []).forEach((s) => {
        const key = String(s.anfrage_id);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });
      setSessionsByRequest(grouped);
    }

    loadSessions();
  }, []);

  // ---------------------------------------------------------
  // HILFSFUNKTIONEN (NEU)
  // ---------------------------------------------------------
  async function moveToTrash(r) {
    await fetch("/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anfrageId: r.id,
        status: "papierkorb",
      }),
    });
    location.reload();
  }

  function openReassign() {
    alert("Therapeut wechseln – kommt im nächsten Schritt.");
  }

  // ---------------------------------------------------------
  // UI — LOGIN
  // ---------------------------------------------------------
  if (!user) {
    return <div style={{ padding: 30 }}>Bitte per Magic Link einloggen…</div>;
  }

  // ---------------------------------------------------------
  // UI — DASHBOARD
  // ---------------------------------------------------------
  return (
    <div style={{ padding: 24, maxWidth: 960, margi
