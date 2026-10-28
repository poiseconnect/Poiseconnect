function careVersion(value) {
  if (value == null) return "0";
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) return value;
  return null;
}

export function currentMeetingLinkOverride(request) {
  const current = careVersion(request?.care_version);
  const linked = careVersion(request?.meeting_link_care_version);
  if (current === null || linked === null || current !== linked) return "";
  return typeof request?.meeting_link_override === "string"
    ? request.meeting_link_override.trim() : "";
}
