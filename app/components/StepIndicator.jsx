export default function StepIndicator({ step, total }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      gap: "10px",
      marginBottom: "32px",
      marginTop: "6px"
    }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? "12px" : "9px",
            height: i === step ? "12px" : "9px",
            borderRadius: "50%",
            background: i === step ? "#d6b9ad" : "#e6ddd9",
            transition: "all 0.25s ease",
          }}
        />
      ))}
    </div>
  );
}
