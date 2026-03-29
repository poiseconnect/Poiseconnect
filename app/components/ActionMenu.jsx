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
        padding: 12,
        width: 280,
        boxShadow: "0 12px 30px rgba(0,0,0,.12)",
      }}
    >
      {actions.map((a) => (
        <div key={a.key} style={{ marginBottom: 12 }}>
          <button
            onClick={() => onAction(a.key)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "#fff",
              border: "none",
              padding: 0,
              fontSize: 16,
              cursor: "pointer",
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
