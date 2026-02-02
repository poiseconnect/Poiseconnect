"use client";

import { useEffect, useState } from "react";
import { teamData } from "./teamData";

export default function useTeamData() {
  const [team, setTeam] = useState([]);

  useEffect(() => {
    setTeam(teamData.filter(t => t.status === "frei"));
  }, []);

  return team;
}
