"use client";
import { useRef } from "react";
import TeamCard from "./TeamCard";

export default function TeamCarousel({ members, activeIndex, setActiveIndex }) {
  const containerRef = useRef(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / (el.clientWidth * 0.9));
    setActiveIndex(index);
  };

  return (
    <div
      className="carousel"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {members.map((m, i) => (
        <TeamCard
          key={m.name}
          member={m}
          active={i === activeIndex}
          onSelect={() => setActiveIndex(i)}
        />
      ))}
    </div>
  );
}
