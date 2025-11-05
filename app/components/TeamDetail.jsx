"use client";

export default function TeamDetail({ member, onSelect }) {
  if (!member) return null;

  return (
    <div className="team-detail" style={{ textAlign: "center", marginTop: 16 }}>
      <img
        src={member.image}
        alt={member.name}
        width={320}
        height={320}
        style={{ borderRadius: 18, objectFit: "cover", width: 320, height: 320 }}
      />

      <h2 style={{ marginTop: 12 }}>{member.name}</h2>
      {member.role && <p className="role">{member.role}</p>}
      {member.bio && <p className="bio" style={{ marginTop: 10 }}>{member.bio}</p>}

      {member.video && (
        <div style={{ marginTop: 12 }}>
          <SmartVideo url={member.video} />
        </div>
      )}

      <button className="select-btn" onClick={() => onSelect(member.name)}>
        Diese Begleitung wählen
      </button>
    </div>
  );
}

function SmartVideo({ url }) {
  const u = (url || "").trim();
  if (!u) return null;
  const isYouTube = /youtube\.com|youtu\.be/.test(u);
  const isVimeo = /vimeo\.com/.test(u);
  const isMp4 = /\.mp4(\?|$)/i.test(u);

  if (isYouTube) {
    const id = u.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] || "";
    return (
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title="Video"
        style={{ width: "100%", height: 220, border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture;"
        allowFullScreen
      />
    );
  }
  if (isVimeo) {
    const id = u.match(/vimeo\.com\/(\d+)/)?.[1] || "";
    return (
      <iframe
        src={`https://player.vimeo.com/video/${id}`}
        title="Video"
        style={{ width: "100%", height: 220, border: 0 }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (isMp4) {
    return (
      <video controls style={{ width: "100%", display: "block" }}>
        <source src={u} type="video/mp4" />
      </video>
    );
  }
  return (
    <a href={u} target="_blank" rel="noreferrer" style={{ color: "#A27C77" }}>
      Video öffnen
    </a>
  );
}
