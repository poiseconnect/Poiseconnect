<form
  onSubmit={async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Fehler beim Absenden");
      setSent(true);

      setForm({
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
    } catch {
      setErr("Es ist ein Fehler aufgetreten. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }}
  style={{ display: "flex", flexDirection: "column", gap: "14px" }}
>

  <input placeholder="Vorname" value={form.vorname}
    onChange={(e) => setForm({ ...form, vorname: e.target.value })} />

  <input placeholder="Nachname" value={form.nachname}
    onChange={(e) => setForm({ ...form, nachname: e.target.value })} />

  <input type="email" placeholder="E-Mail" value={form.email}
    onChange={(e) => setForm({ ...form, email: e.target.value })} />

  <input placeholder="Straße & Hausnummer" value={form.strasse_hausnr}
    onChange={(e) => setForm({ ...form, strasse_hausnr: e.target.value })} />

  <input placeholder="PLZ & Ort" value={form.plz_ort}
    onChange={(e) => setForm({ ...form, plz_ort: e.target.value })} />

  <input type="date" placeholder="Geburtsdatum" value={form.geburtsdatum}
    onChange={(e) => setForm({ ...form, geburtsdatum: e.target.value })} />

  <input placeholder="Beschäftigungsgrad" value={form.beschaeftigungsgrad}
    onChange={(e) => setForm({ ...form, beschaeftigungsgrad: e.target.value })} />

  <textarea placeholder="Leidensdruck" value={form.leidensdruck}
    onChange={(e) => setForm({ ...form, leidensdruck: e.target.value })} />

  <textarea placeholder="Dein Anliegen" value={form.anliegen}
    onChange={(e) => setForm({ ...form, anliegen: e.target.value })} />

  <textarea placeholder="Bisheriger Verlauf" value={form.verlauf}
    onChange={(e) => setForm({ ...form, verlauf: e.target.value })} />

  <textarea placeholder="Ziel der Therapie" value={form.ziel}
    onChange={(e) => setForm({ ...form, ziel: e.target.value })} />

  <select value={form.wunschtherapeut}
    onChange={(e) => setForm({ ...form, wunschtherapeut: e.target.value })}>
    <option value="">Wunschtherapeut auswählen</option>
    {team.map((t) => <option key={t} value={t}>{t}</option>)}
  </select>

  <input placeholder="Bevorzugter Zeitraum (z.B. Mo Nachmittags)" value={form.bevorzugte_zeit}
    onChange={(e) => setForm({ ...form, bevorzugte_zeit: e.target.value })} />

  <label>
    <input
      type="checkbox"
      checked={form.check_suizid}
      onChange={() => setForm({ ...form, check_suizid: !form.check_suizid })}
    /> Keine akute Suizidgefahr
  </label>

  <label>
    <input
      type="checkbox"
      checked={form.check_datenschutz}
      onChange={() => setForm({ ...form, check_datenschutz: !form.check_datenschutz })}
      required
    /> Datenschutz akzeptieren
  </label>

  {err && <p style={{ color: "red" }}>{err}</p>}

  <button
    type="submit"
    disabled={loading}
    style={{ background: "#000", color: "#fff", padding: "14px", borderRadius: "6px" }}
  >
    {loading ? "Senden..." : "Absenden"}
  </button>

</form>
