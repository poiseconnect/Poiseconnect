"use client";

// Rein lesende Admin-Übersicht: Heatmap der Themengewichtungen,
// Intake-Verfügbarkeit und Themenabdeckung. Keine Eingabefelder,
// keine Schreibzugriffe – Sortierung und Themenfilter sind reiner UI-State.

import { useEffect, useMemo, useState } from "react";
import { MATCHING_TOPICS } from "../lib/matchingTopics";
import { teamData } from "../lib/teamData";
import {
  MAX_MATCHING_SCORE,
  buildMatchingOverviewRows,
  buildTopicCoverage,
  sortOverviewRows,
  sortTopicCoverage,
} from "../lib/matchingOverview";

// Statischer Fallback wie in der produktiven Matching-Regel
// (app/page-client.jsx): dbScores[key] ?? teamData-scores[key] ?? 0
const FALLBACK_SCORES_BY_ID = Object.fromEntries(
  teamData
    .filter((member) => member?.id)
    .map((member) => [String(member.id), member.scores || {}])
);

const AVAILABILITY_BADGES = {
  available: {
    label: "Nimmt neue Klient:innen auf",
    short: "Verfügbar",
    background: "#E8FFF0",
    border: "#90D5A0",
    color: "#0B6E4F",
    dot: "#2EAD5B",
  },
  paused: {
    label: "Aktiv, aber keine Neuaufnahme",
    short: "Keine Aufnahme",
    background: "#FFF4E0",
    border: "#E3C07A",
    color: "#8A6D00",
    dot: "#E3AC1D",
  },
  inactive: {
    label: "Inaktives Teammitglied",
    short: "Inaktiv",
    background: "#F2F2F2",
    border: "#CCCCCC",
    color: "#666666",
    dot: "#999999",
  },
};

const COVERAGE_STYLES = {
  none: { label: "Keine verfügbaren Coaches", background: "#FDECEA", color: "#B3261E" },
  low: { label: "Nur 1 verfügbarer Coach", background: "#FFF4E0", color: "#8A6D00" },
  ok: { label: "Abgedeckt", background: "#F4F6F8", color: "#2C3E50" },
  strong: { label: "Stark abgedeckt", background: "#E8FFF0", color: "#0B6E4F" },
};

function heatCellStyle(score) {
  const intensity = Math.max(0, Math.min(1, score / MAX_MATCHING_SCORE));

  if (intensity === 0) {
    return { background: "#F7F7F7", color: "#BBB" };
  }

  // Grünskala passend zur bestehenden Dashboard-Farbwelt
  return {
    background: `rgba(11, 110, 79, ${0.12 + intensity * 0.88})`,
    color: intensity >= 0.5 ? "#fff" : "#1A3C2E",
    fontWeight: intensity >= 0.8 ? 700 : 500,
  };
}

function SortIndicator({ active, direction }) {
  if (!active) return <span style={{ opacity: 0.35 }}> ↕</span>;
  return <span> {direction === "asc" ? "▲" : "▼"}</span>;
}

export default function MatchingOverview({ getAccessToken }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedTopics, setSelectedTopics] = useState([]); // leer = alle Themen

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/admin/matching-overview", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const json = await res.json();

        if (!mounted) return;

        if (!res.ok) {
          setLoadError(json?.error || "LOAD_FAILED");
          setMembers([]);
        } else {
          setMembers(json.members || []);
        }
      } catch {
        if (mounted) {
          setLoadError("LOAD_FAILED");
          setMembers([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [getAccessToken]);

  const rows = useMemo(
    () =>
      buildMatchingOverviewRows(members, MATCHING_TOPICS, FALLBACK_SCORES_BY_ID),
    [members]
  );

  const sortedRows = useMemo(
    () => sortOverviewRows(rows, { sortBy, direction: sortDirection }),
    [rows, sortBy, sortDirection]
  );

  const visibleTopics = useMemo(() => {
    if (!selectedTopics.length) return MATCHING_TOPICS;
    return MATCHING_TOPICS.filter((topic) => selectedTopics.includes(topic.key));
  }, [selectedTopics]);

  const coverage = useMemo(
    () => sortTopicCoverage(buildTopicCoverage(rows)),
    [rows]
  );

  const availableCount = rows.filter((r) => r.acceptsNewClients).length;
  const pausedCount = rows.filter((r) => r.availabilityStatus === "paused").length;
  const inactiveCount = rows.filter((r) => r.availabilityStatus === "inactive").length;

  function toggleSort(nextSortBy, defaultDirection = "asc") {
    if (sortBy === nextSortBy) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSortBy);
      setSortDirection(defaultDirection);
    }
  }

  function toggleTopic(topicKey) {
    setSelectedTopics((current) =>
      current.includes(topicKey)
        ? current.filter((key) => key !== topicKey)
        : [...current, topicKey]
    );
  }

  if (loading) {
    return (
      <section style={{ padding: 24, color: "#777" }}>
        Lade Matching-Übersicht …
      </section>
    );
  }

  if (loadError) {
    return (
      <section
        style={{
          padding: 24,
          border: "1px solid #E3C07A",
          borderRadius: 12,
          background: "#FFF4E0",
          color: "#8A6D00",
        }}
      >
        Matching-Übersicht konnte nicht geladen werden ({loadError}).
      </section>
    );
  }

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
      }}
    >
      <h2 style={{ marginTop: 0 }}>📊 Matching-Übersicht</h2>
      <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
        Rein lesende Ansicht: effektive Themengewichtungen (0–{MAX_MATCHING_SCORE})
        nach der produktiven Matching-Regel (DB-Wert, sonst statischer
        teamData-Fallback – mit&nbsp;* markiert) und aktuelle
        Intake-Verfügbarkeit. Änderungen sind hier nicht möglich.
      </p>

      {/* VERFÜGBARKEIT – ZUSAMMENFASSUNG */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          margin: "12px 0 16px",
        }}
      >
        {[
          {
            status: "available",
            count: availableCount,
            text: "nehmen neue Klient:innen auf",
          },
          { status: "paused", count: pausedCount, text: "ohne Neuaufnahme" },
          { status: "inactive", count: inactiveCount, text: "inaktiv" },
        ].map(({ status, count, text }) => {
          const badge = AVAILABILITY_BADGES[status];
          return (
            <div
              key={status}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                background: badge.background,
                border: `1px solid ${badge.border}`,
                color: badge.color,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: badge.dot,
                  marginRight: 6,
                }}
              />
              {count} {text}
            </div>
          );
        })}
      </div>

      {/* THEMENFILTER */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
          Themenfilter (Spalten ein-/ausblenden):
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setSelectedTopics([])}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid #ccc",
              background: selectedTopics.length === 0 ? "#2C3E50" : "#fff",
              color: selectedTopics.length === 0 ? "#fff" : "#333",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Alle Themen
          </button>
          {MATCHING_TOPICS.map((topic) => {
            const selected = selectedTopics.includes(topic.key);
            return (
              <button
                key={topic.key}
                type="button"
                onClick={() => toggleTopic(topic.key)}
                title={topic.description}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: selected ? "1px solid #0B6E4F" : "1px solid #ccc",
                  background: selected ? "#E8FFF0" : "#fff",
                  color: selected ? "#0B6E4F" : "#333",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* HEATMAP */}
      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 2,
            minWidth: 600,
          }}
        >
          <thead>
            <tr>
              <th
                onClick={() => toggleSort("name", "asc")}
                style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  cursor: "pointer",
                  position: "sticky",
                  left: 0,
                  background: "#fff",
                  zIndex: 1,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
                title="Nach Teammitglied sortieren"
              >
                Teammitglied
                <SortIndicator active={sortBy === "name"} direction={sortDirection} />
              </th>
              <th
                onClick={() => toggleSort("availability", "asc")}
                style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
                title="Nach Verfügbarkeit sortieren"
              >
                Verfügbarkeit
                <SortIndicator
                  active={sortBy === "availability"}
                  direction={sortDirection}
                />
              </th>
              {visibleTopics.map((topic) => (
                <th
                  key={topic.key}
                  onClick={() => toggleSort(topic.key, "desc")}
                  title={`${topic.label} – ${topic.description}\nKlicken, um nach dieser Gewichtung zu sortieren`}
                  style={{
                    padding: "6px 4px",
                    cursor: "pointer",
                    fontSize: 11,
                    maxWidth: 90,
                    verticalAlign: "bottom",
                  }}
                >
                  {topic.label}
                  <SortIndicator
                    active={sortBy === topic.key}
                    direction={sortDirection}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const badge =
                AVAILABILITY_BADGES[row.availabilityStatus] ||
                AVAILABILITY_BADGES.inactive;

              return (
                <tr key={row.id || row.name}>
                  <td
                    style={{
                      padding: "6px 10px",
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      position: "sticky",
                      left: 0,
                      background: "#fff",
                      zIndex: 1,
                      opacity: row.availabilityStatus === "inactive" ? 0.5 : 1,
                    }}
                  >
                    {row.name}
                  </td>
                  <td
                    title={badge.label}
                    style={{
                      padding: "4px 8px",
                      whiteSpace: "nowrap",
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 999,
                        background: badge.background,
                        border: `1px solid ${badge.border}`,
                        color: badge.color,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: badge.dot,
                          marginRight: 5,
                        }}
                      />
                      {badge.short}
                    </span>
                  </td>
                  {visibleTopics.map((topic) => {
                    const score = row.scores[topic.key] ?? 0;
                    const isFallback = row.fallbackTopicKeys?.includes(
                      topic.key
                    );
                    return (
                      <td
                        key={topic.key}
                        title={`${row.name} – ${topic.label}: ${score} / ${MAX_MATCHING_SCORE}${
                          isFallback
                            ? " (statischer teamData-Fallback, kein DB-Wert)"
                            : ""
                        }`}
                        style={{
                          width: 54,
                          minWidth: 54,
                          height: 34,
                          textAlign: "center",
                          borderRadius: 6,
                          fontSize: 13,
                          ...heatCellStyle(score),
                        }}
                      >
                        {score}
                        {isFallback ? "*" : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedRows.length === 0 && (
        <div style={{ padding: 16, color: "#777" }}>
          Keine Teammitglieder gefunden.
        </div>
      )}

      {/* THEMENABDECKUNG */}
      <h3 style={{ marginTop: 24 }}>🧭 Themenabdeckung (verfügbare Coaches)</h3>
      <p style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
        Zählt je Thema die Coaches mit Gewichtung &gt; 0, die aktuell neue
        Klient:innen aufnehmen. Basis sind ausschließlich die vorhandenen
        Gewichtungen – keine Kapazitätsprognose.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 8,
        }}
      >
        {coverage.map((entry) => {
          const style = COVERAGE_STYLES[entry.coverageLevel] || COVERAGE_STYLES.ok;
          const barWidth = availableCount
            ? Math.round((entry.availableCoachCount / availableCount) * 100)
            : 0;

          return (
            <div
              key={entry.key}
              title={`${entry.label}: ${entry.availableCoachCount} verfügbare Coaches (gesamt ${entry.totalCoachCount} mit Gewichtung > 0), Summe der Gewichtungen verfügbarer Coaches: ${entry.availableWeightSum}, höchste Gewichtung: ${entry.availableMaxScore}`}
              style={{
                border: "1px solid #e2e2e2",
                borderRadius: 10,
                padding: "10px 12px",
                background: style.background,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#2C3E50",
                }}
              >
                <span>{entry.label}</span>
                <span style={{ color: style.color }}>
                  {entry.availableCoachCount}
                </span>
              </div>
              <div
                style={{
                  marginTop: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: style.color,
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: style.color }}>
                {style.label}
                {entry.availableCoachCount > 0 &&
                  ` · Gewichtungssumme ${entry.availableWeightSum} · max. ${entry.availableMaxScore}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
