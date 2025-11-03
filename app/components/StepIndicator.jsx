export default function StepIndicator({ step, total }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      gap: "8px",
      marginBottom: "32px"
    }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: i === step ? "black" : "#d9d9d9",
            transition: "0.3s"
          }}
        />
      ))}
    </div>
  );
}
