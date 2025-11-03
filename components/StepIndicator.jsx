"use client";

export default function StepIndicator({ step, total = 7 }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 30 }}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === step;
        const isDone = i < step;

        return (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: isActive ? "var(--mint)" : isDone ? "var(--gelb)" : "white",
              border: isActive ? "2px solid var(--rosa-dark)" : "2px solid var(--rosa)",
              transition: "0.3s",
            }}
          />
        );
      })}
    </div>
  );
}
