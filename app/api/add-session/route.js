async function saveSession() {
  if (!sessionModal) return;
  if (!sessionDate) return alert("Datum fehlt");

  const price = Number(sessionModal.honorar_klient);
  if (!price) {
    alert("Kein Stundensatz hinterlegt");
    return;
  }

  const res = await fetch("/api/add-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anfrageId: sessionModal.id,
      therapist: user.email,
      date: sessionDate,
      duration: sessionDuration,
      price, // ✅ JETZT IM BODY
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("ADD SESSION ERROR:", err);
    alert("Fehler beim Speichern der Sitzung");
    return;
  }

  alert("Sitzung gespeichert");
  location.reload();
}
