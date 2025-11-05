export default function TeamDetail({ member, onSelect }) {
  if (!member) return null;

  return (
    <div className="team-detail">
      <img src={member.image} className="team-detail-img" />

      <h2>{member.name}</h2>
      <p className="team-role">{member.role}</p>

      {member.bio && <p className="team-bio">{member.bio}</p>}

      {member.video && (
        <div className="team-video">
          <iframe
            src={member.video}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          ></iframe>
        </div>
      )}

      <button className="select-btn" onClick={() => onSelect(member.name)}>
        Diese Psychologin auswählen
      </button>
    </div>
  );
}
