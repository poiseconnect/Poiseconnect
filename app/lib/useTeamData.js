"use client";
import { useEffect, useState } from "react";

export default function useTeamData() {
  const [team, setTeam] = useState([]);

  useEffect(() => {
    fetch("/api/team")
      .then(res => res.json())
      .then(data => {
        setTeam(
          data.map(p => ({
            name: p["Name"],
            role: p["Rolle / Titel"],
            short: p["Kurzbeschreibung"],
            long: p["Langbeschreibung"],
            tags: p["tags"]?.split(";").map(t => t.trim()) ?? [],
            image: p["image"],
            video: p["video"],
            available: p["available"]?.toLowerCase() === "true"
          }))
        );
      });
  }, []);

  return team;
}
