"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { teamData } from "../teamData";

/* ================= STATUS ================= */

function normalizeStatus(raw) {
  if (!raw) return "offen";
  const s = String(raw).toLowerCase().trim();

  if (["offen", "neu", ""].includes(s)) return "offen";
  if (["termin_neu", "new_appointment"].includes(s)) return "termin_neu";
  if (
    [
      "termin_bestaetigt",
      "termin bestätigt",
      "confirmed",
      "appointment_confirmed",
      "bestaetigt",
    ].includes(s)
  )
    return "termin_bestaetigt";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["kein_match", "no_match"].includes(s)) return "kein_match";
  if (["beendet", "finished"].includes(s)) return "beendet";
  if (["papierkorb"].includes(s)) return "papierkorb";

  return "offen";
}

const STATUS_LABEL = {
  offen: "Neu",
  termin_neu: "Neuer Termin",
  termin_bestaetigt: "Termin bestätigt",
  active: "Begleitung aktiv",
  kein_match: "Kein Match",
  beendet: "Beendet",
  papierkorb: "Papierkorb",
};

/* ================= MODAL ================= */

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          maxWidth: 900,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ================= DASHBOARD ================= */

export default function DashboardFull() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessionsByRequest, setSessionsByRequest] = useState({});
  const [filter, setFilter] = useState("unbearbeitet");
  const [therapistFilter, setTherapistFilter] = useState("alle");

  const [detailsModal, setDetailsModal] = useState(null);
  const [editTarif, setEditTarif] = useState("");

  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionDuration, setNewSessionDuration] = useState(60);

  /* ---------- LOAD USER ---------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  /* ---------- LOAD REQUESTS ---------- */
  useEffect(() => {
    if (!user?.email) return;

    let query = supabase
      .from("anfragen")
      .select("*")
      .order("created_at", { ascending: false });

    if (user.email !== "hallo@mypoise.de") {
      query = query.eq("wunschtherapeut", user.email);
    }

    query.then(({ data }) => {
      setRequests(
        (data || []).map((r) => ({
          ...r,
          _status: normalizeStatus(r.status),
        }))
      );
    });
  }, [user]);

  /* ---------- LOAD SESSIONS ---------- */
  useEffect(() => {
    supabase.from("sessions").select("*").then(({ data }) => {
      const grouped = {};
      (data || []).forEach((s) => {
        if (!grouped[s.anfrage_id]) grouped[s.anfrage_id] = [];
        grouped[s.anfrage_id].push(s);
      });
      setSessionsByRequest(grouped);
    });
  }, []);

  /* ---------- FILTER ---------- */
  const UNBEARBEITET = ["offen", "termin_neu", "termin_bestaetigt"];

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filter === "unbearbeitet" && !UNBEARBEITET.includes(r._status))
        return false;
      if (filter === "aktiv" && r._status !== "active") return false;
      if (filter === "papierkorb" && r._status !== "papierkorb") return false;
      if (
        therapistFilter !== "alle" &&
        r.wunschtherapeut !== therapistFilter
      )
        return false;
      return true;
    });
  }, [requests, filter, therapistFilter]);

  if (!user) return <div>Bitte einloggen…</div>;

  /* ================= UI ================= */

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      {/* FILTER */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setFilter("unbearbeitet")}>Unbearbeitet</button>
        <button onClick={() => setFilter("aktiv")}>Aktiv</button>
        <button onClick={() => setFilter("papierkorb")}>Papierkorb</button>
        <button onClick={() => setFilter("alle")}>Alle</button>

        <select
          value={therapistFilter}
          onChange={(e) => setTherapistFilter(e.target.value)}
        >
          <option value="alle">Alle Teammitglieder</option>
          {teamData.map((t) => (
            <option key={t.email} value={t.email}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* KARTEN */}
      {filtered.map((r) => (
        <article
          key={r.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <str
