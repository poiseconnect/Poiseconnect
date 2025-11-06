"use client";
import Image from "next/image";

export default function TeamDetail({ member, onSelect }) {
  if (!member) return null;

  return (
    <div className="team-detail">
      <Image src={member.image} width={180} height={180} alt={member.name} className="profile-img" />
      
      <h3>{member.name}</h3>
      <p className="role">{member.role}</p>
      <p className="short">{member.short}</p>

      {member.long && <p className="long-text">{member.long}</p>}

      {member.video && (
        <video
          src={member.video}
          controls
          className="profile-video"
        />
      )}

      <button className="select-btn" onClick={() => onSelect(member.name)}>
        {member.available ? "Diese Person auswählen" : "Aktuell ausgebucht"}
      </button>
    </div>
  );
}
