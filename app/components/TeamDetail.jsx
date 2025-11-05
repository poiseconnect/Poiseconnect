"use client";
import Image from "next/image";

export default function TeamDetail({ member, onSelect }) {
  if (!member) return null;

  return (
    <div className="team-detail">
      <h2>{member.name}</h2>
      <p className="role">{member.title}</p>

      <Image src={member.image} width={320} height={320} alt={member.name} className="detail-img" />

      <p className="bio">{member.description}</p>

      {member.video && (
        <video controls className="detail-video">
          <source src={member.video} type="video/mp4" />
        </video>
      )}

      <button className="select-btn" onClick={() => onSelect(member.name)}>
        Diese Begleitung wählen
      </button>
    </div>
  );
}
