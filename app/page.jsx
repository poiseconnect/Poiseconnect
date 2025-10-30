"use client";

import { useState } from "react";

export default function Home() {
  const [form, setForm] = useState({
    vorname: "",
    nachname: "",
    email: "",
    strasse_hausnr: "",
    plz_ort: "",
    geburtsdatum: "",
    beschaeftigungsgrad: "",
    leidensdruck: "",
    anliegen: "",
    verlauf: "",
    ziel: "",
    wunschtherapeut: "",
    check_suizid: false,
    check_datenschutz: false,
    bevorzugte_zeit: "",
  });

  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const team = [
    "Linda",
    "Ann",
    "Anna",
    "Anja",
    "Babette",
    "Carolin",
    "Caroline",
    "Elena",
    "Franziska",
    "Gerhard",
    "Gesine",
    "Isabella",
    "Jenny",
    "Judith",
    "Julius",
    "Kristin",
    "Kristin-Sofie",
    "Livia",
    "Magdalena",
    "Marisa",
    "Marleen",
    "Sophie",
    "Yanina",
    "Keine Präferenz",
  ];

  return (
    <div>Form kommt hier rein</div>
  );
}
