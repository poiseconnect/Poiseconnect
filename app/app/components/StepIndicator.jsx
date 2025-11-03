"use client";

export default function StepIndicator({ currentStep, totalSteps }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      gap: "8px",
      margin: "24px 0"
    }}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            border: "2px solid #d9d9d9",
            backgroundColor: index === currentStep ? "#E5C15A" : "transparent" // Gold = aktiv
          }}
        />
      ))}
    </div>
  );
}
