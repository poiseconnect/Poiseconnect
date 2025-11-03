"use client";

export default function StepIndicator({ step, total = 9 }) {
  const items = Array.from({ length: total });
  return (
    <div className="steps">
      {items.map((_, i) => (
        <span
          key={i}
          className={[
            "step-dot",
            i < step ? "done" : "",
            i === step ? "active" : "",
          ].join(" ")}
          aria-label={`Schritt ${i + 1} von ${total}`}
        />
      ))}
    </div>
  );
}
