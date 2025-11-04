import { TOPIC_KEYWORDS } from "./topics";

export function detectTags(text) {
  const lower = text.toLowerCase();
  const detected = [];

  for (const tag in TOPIC_KEYWORDS) {
    if (TOPIC_KEYWORDS[tag].some(keyword => lower.includes(keyword))) {
      detected.push(tag);
    }
  }

  return detected;
}
