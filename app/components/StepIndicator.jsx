"use client";

export default function StepIndicator({ step, total }) {
  return (
    <div className="step-indicator">
      {[...Array(total)].map((_, i) => (
        <div
          key={i}
          className={`step-dot ${i === step ? "active" : ""}`}
        />
      ))}
    </div>
  );
}
