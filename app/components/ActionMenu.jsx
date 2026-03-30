"use client";

export default function ActionMenu({ actions, onAction, color }) {
  const baseColor = color?.base || "#F4F6F8";     // 🔥 Pillen-Farbe (unten)
  const activeColor = color?.active || "#2C3E50"; // Kreis (nur Border)

  // 🔥 automatische Textfarbe (wichtig für gelb etc.)
  const isLight =
    baseColor === "#E3AC1D" || // gelb
    baseColor === "#CBE34B" || // lime
    baseColor === "#F4F6F8";

  const textColor = isLight ? "#000" : "#fff";

  return (
<div
  style={{
    position: "fixed",
    top: 100,
    left: 16,
    right: 16,
    zIndex: 9999,
    background: "#fff",
    border: `2px solid ${activeColor}`,
    borderRadius: 18,
    padding: 12,
    maxWidth: 420,
    margin: "0 auto",
    boxShadow: "0 20px 60px rgba(0,0,0,.2)",
    maxHeight: "60vh",
overflowY: "auto",
  }}
>
      {actions.map((a) => (
        <div key={a.key} style={{ marginBottom: 10 }}>
          <button
            onClick={() => onAction(a.key)}
            style={{
              width: "100%",
              textAlign: "left",
              background: baseColor, // 🔥 HIER IST DER FIX
              color: textColor,
              border: "none",
              borderRadius: 14,
              padding: "12px 14px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              lineHeight: 1.2,
            }}
          >
            {a.label}
          </button>

          {a.hint && (
            <div
              style={{
                fontSize: 12,
                color: "#666",
                marginTop: 6,
                lineHeight: 1.35,
                paddingLeft: 2,
              }}
            >
              {a.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
