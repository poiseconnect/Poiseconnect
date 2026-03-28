"use client";

export default function ActionMenu({ actions, onAction }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 10,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        padding: 8,
        zIndex: 100,
        minWidth: 200,
      }}
    >
      {actions.map((a) => (
        <div
          key={a.key}
          onClick={() => onAction(a.key)}
          style={{
            padding: "10px 12px",
            cursor: "pointer",
            borderRadius: 8,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "#F5F5F5")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          {a.label}
        </div>
      ))}
    </div>
  );
}
