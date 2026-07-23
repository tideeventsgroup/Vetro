import type { GapFinding } from "./vettingCompliance.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("AI compliance review isn't configured — GROQ_API_KEY is missing.");
    this.name = "GroqNotConfiguredError";
  }
}

// The deterministic checker (vettingCompliance.ts) catches the numeric
// BS7858/BPSS rules; this is for what that can't — reading the actual
// submitted text for things like an implausible address, a reference whose
// relationship reads more like a friend than a line manager, or employment
// history that's internally inconsistent in a way no date-math would flag.
// Vetro still doesn't perform any check itself; this is a second pair of
// eyes on what a human reviewer would otherwise have to read unassisted.
export async function getAiComplianceReview(input: {
  officerName: string;
  findings: GapFinding[];
  addressHistory: unknown;
  employmentHistory: unknown;
  references: unknown;
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const prompt = [
    `Candidate: ${input.officerName}`,
    "",
    `Automated BS7858/BPSS checks already found:`,
    input.findings.length === 0
      ? "(none — all automated checks passed)"
      : input.findings.map((f) => `- [${f.standard}, ${f.severity}] ${f.message}`).join("\n"),
    "",
    `Address history: ${JSON.stringify(input.addressHistory)}`,
    `Employment history: ${JSON.stringify(input.employmentHistory)}`,
    `References: ${JSON.stringify(input.references)}`,
  ].join("\n");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You review UK security-industry pre-employment vetting submissions against BS7858 and BPSS. " +
            "You're given the automated date/gap checks already run — don't repeat those findings. Instead, " +
            "read the raw address/employment/reference data for anything a human reviewer should double-check: " +
            "internal inconsistencies, implausible entries, references that don't look like genuine employer " +
            "contacts, or anything else worth a second look. Reply in 3-5 short bullet points. If nothing stands " +
            "out beyond the automated checks, say so plainly in one line rather than inventing concerns.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Groq API error (${response.status}): ${body || response.statusText}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq API returned an empty response");
  return content;
}
