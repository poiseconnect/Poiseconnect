"use client";

export default function CoachVideoModal({ url, onClose }) {
  if (!url) return null;

  const id =
    url.match(
      /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?/]+)/
    )?.[1] || "";

  const embed = id
    ? `https://www.youtube.com/embed/${id}`
    : url;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vorstellungsvideo"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 640,
          background: "#fff",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Video schließen"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ×
        </button>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
          }}
        >
          <iframe
            src={embed}
            title="Vorstellungsvideo"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
