export default function StepIndicator({ step, total }) {
  return (
    <div className="step-indicator-wrapper">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`step-dot ${i === step ? "active" : ""}`} />
      ))}
    </div>
  );
}
