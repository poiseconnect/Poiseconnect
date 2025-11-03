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
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: isActive ? "#CDEAE0" : isDone ? "#E4D39F" : "white",
              border: isActive ? "2px solid #EFB1B1" : "2px solid #EFBEC0",
              transition: "0.3s",
            }}
          />
        );
      })}
    </div>
  );
}
