export default function TeamCard({ member, active, onSelect }) {
  return (
    <div
      className={`team-card ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <img src={member.image} alt={member.name} className="team-card-img" />

      <h4>{member.name}</h4>
      {member.short && <p className="team-card-short">{member.short}</p>}
    </div>
  );
}
