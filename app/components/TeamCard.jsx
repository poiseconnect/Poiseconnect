"use client";
import Image from "next/image";

export default function TeamCarousel({ members, activeIndex, setActiveIndex }) {
  return (
    <div className="carousel">
      {members.map((m, i) => (
        <div
          key={m.name}
          className={`carousel-item ${i === activeIndex ? "active" : ""}`}
          onClick={() => setActiveIndex(i)}
        >
          <Image src={m.image} width={80} height={80} alt={m.name} />
          <p>{m.name}</p>
        </div>
      ))}
    </div>
  );
}
