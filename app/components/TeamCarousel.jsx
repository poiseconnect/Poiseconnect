"use client";
import Image from "next/image";
import { useRef } from "react";

export default function TeamCarousel({ members, activeIndex, setActiveIndex }) {
  const scrollRef = useRef(null);

  const scrollToIndex = (index) => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.children[0].offsetWidth;
    scrollRef.current.scrollTo({
      left: cardWidth * index,
      behavior: "smooth",
    });
    setActiveIndex(index);
  };

  const next = () => activeIndex < members.length - 1 && scrollToIndex(activeIndex + 1);
  const prev = () => activeIndex > 0 && scrollToIndex(activeIndex - 1);

  return (
    <div className="carousel-wrapper">
      <div className="carousel-scroll" ref={scrollRef}>
        {members.map((m, i) => (
          <div
            key={m.name}
            className={`carousel-card ${i === activeIndex ? "active" : ""}`}
            onClick={() => scrollToIndex(i)}
          >
            <Image src={m.image} alt={m.name} width={260} height={260} className="carousel-img" />
            <h3>{m.name}</h3>
            <p className="role">{m.title}</p>
            <p className="tags">{m.tags?.slice(0, 4).join(" • ")}</p>
          </div>
        ))}
      </div>

      <div className="carousel-controls">
        <button onClick={prev} disabled={activeIndex === 0}>←</button>
        <button onClick={next} disabled={activeIndex === members.length - 1}>→</button>
      </div>
    </div>
  );
}
