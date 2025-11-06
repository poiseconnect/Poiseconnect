"use client";

export default function TeamDetail({ member, onSelect }) {
  if (!member) return null;

  return (
    <div className="team-detail">

      {/* Bild */}
      <img src={member.image} alt={member.name} className="team-detail-img" />

      {/* Name und Rolle */}
      <h3>{member.name}</h3>
      {member.role && <p className="role">{member.role}</p>}

      {/* Kurzbeschreibung */}
      {member.shortDescription && (
        <p className="short-desc">{member.shortDescription}</p>
      )}

      {/* Langtext (scrollbar) */}
      {member.longDescription && (
        <div className="long-desc">
          {member.longDescription.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      {/* Video - wird nur angezeigt wenn vorhanden */}
      {member.video && (
        <div className="video-wrapper">
          <iframe
            src={member.video}
            title={member.name + " Video"}
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Button */}
      <button
        className="select-button"
        onClick={() => onSelect(member.name)}
      >
        Diesen Coach auswählen
      </button>
    </div>
  );
}
