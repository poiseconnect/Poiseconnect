
"use client";

export default function ActionMenu({ actions, onAction, color }) {
  const activeColor = color?.active || "#2C3E50";
  const softColor = color?.base || "#F4F6F8";
  const textColor = activeColor === "#EDEDED" ? "#000" : "#fff";

  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        right: 0,
        zIndex: 20,
        background: "#fff",
        border: `1px solid ${activeColor}`,
        borderRadius: 18,
        padding: 14,
        width: 320,
        boxShadow: "0 16px 36px rgba(0,0,0,.14)",
      }}
    >
      {actions.map((a) => (
        <div key={a.key} style={{ marginBottom: 12 }}>
          <button
            onClick={() => onAction(a.key)}
            style={{
              width: "100%",
              textAlign: "left",
              background: activeColor,
              color: textColor,
              border: "none",
              borderRadius: 14,
              padding: "14px 16px",
              fontSize: 17,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {a.label}
          </button>

          {a.hint && (
            <div
              style={{
                fontSize: 13,
                color: "#555",
                marginTop: 6,
                lineHeight: 1.4,
                paddingLeft: 4,
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
