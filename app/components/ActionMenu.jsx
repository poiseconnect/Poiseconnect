export default function ActionMenu({ actions, onAction }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 0,
        zIndex: 20,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 16,
        padding: 10,
        width: 280,
        boxShadow: "0 12px 30px rgba(0,0,0,.12)",
      }}
    >
      {actions.map((a) => (
        <div key={a.key} style={{ marginBottom: 8 }}>
          <button
            onClick={() => onAction(a.key)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "#fff",
              border: "1px solid transparent",
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              color: "#1E2A3A", // 🔥 FIX: dunkle Schrift
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F4F6F8";
              e.currentTarget.style.borderColor = "#E0E0E0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            {a.label}
          </button>

          {a.hint && (
            <div
              style={{
                fontSize: 12,
                color: "#666",
                marginTop: 4,
                paddingLeft: 4,
                lineHeight: 1.4,
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
