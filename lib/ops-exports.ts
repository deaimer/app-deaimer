import type { DCSession, DCSpeaker } from "@/lib/firebase/data-collection";

// ─── Utilities ────────────────────────────────────────────────────────────────

export function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTimestamp(val: unknown): string {
  if (!val) return "";
  try {
    const ts = (val as { toDate?: () => Date }).toDate?.();
    return (ts ?? new Date(val as string)).toISOString();
  } catch {
    return "";
  }
}

function csvCell(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export function generateMetadataCSV(
  sessions: DCSession[],
  speakerMap: Map<string, DCSpeaker>,
): string {
  const headers = [
    "session_id", "project_id", "project_name",
    "speaker_id", "speaker_name", "gender", "age", "age_group",
    "country", "region", "language", "dialect",
    "education_level", "device_category", "device_manufacturer", "device_model",
    "sample_rate_hz", "bit_depth", "duration_sec",
    "audio_url", "file_path", "prompt_text",
    "transcription_status", "verbatim_text", "wer_score",
    "qa_status", "qa_score", "qa_note", "qa_reviewer",
    "created_at",
  ];

  const rows = sessions.map((s) => {
    const sp = speakerMap.get(s.speakerId);
    return csvRow([
      s.id, s.projectId, s.projectName,
      s.speakerId, s.speakerName,
      sp?.gender ?? s.gender,
      sp?.age ?? s.age,
      sp?.ageGroup ?? "",
      sp?.country ?? "",
      sp?.region ?? s.region,
      sp?.languages?.[0] ?? s.dialect,
      s.dialect,
      sp?.educationLevel ?? "",
      sp?.deviceCategory ?? "",
      sp?.deviceManufacturer ?? "",
      sp?.deviceModel ?? "",
      s.sampleRate, s.bitDepth, s.duration,
      s.audioUrl, s.filePath,
      s.promptText ?? "",
      s.transcriptionStatus, s.transcriptText, s.werScore ?? "",
      s.qaStatus, s.qaScore ?? "", s.qaNote, s.qaReviewerEmail,
      formatTimestamp(s.createdAt),
    ]);
  });

  return [headers.join(","), ...rows].join("\n");
}

export function generateMetadataJSON(
  sessions: DCSession[],
  speakerMap: Map<string, DCSpeaker>,
): string {
  const records = sessions.map((s) => {
    const sp = speakerMap.get(s.speakerId);
    return {
      id: s.id,
      project_id: s.projectId,
      project_name: s.projectName,
      speaker: {
        id: s.speakerId,
        name: s.speakerName,
        gender: sp?.gender ?? s.gender,
        age: sp?.age ?? s.age,
        age_group: sp?.ageGroup ?? "",
        country: sp?.country ?? "",
        region: sp?.region ?? s.region,
        language: sp?.languages?.[0] ?? s.dialect,
        education_level: sp?.educationLevel ?? "",
        device_category: sp?.deviceCategory ?? "",
        device_manufacturer: sp?.deviceManufacturer ?? "",
        device_model: sp?.deviceModel ?? "",
      },
      audio: {
        url: s.audioUrl,
        file_path: s.filePath,
        sample_rate_hz: s.sampleRate,
        bit_depth: s.bitDepth,
        duration_sec: s.duration,
      },
      prompt_text: s.promptText ?? null,
      transcription_status: s.transcriptionStatus,
      verbatim_text: s.transcriptText || null,
      wer_score: s.werScore,
      qa_status: s.qaStatus,
      qa_score: s.qaScore,
      qa_note: s.qaNote || null,
      qa_reviewer: s.qaReviewerEmail || null,
      created_at: formatTimestamp(s.createdAt),
    };
  });
  return JSON.stringify(records, null, 2);
}

// ─── Transcription JSON ───────────────────────────────────────────────────────

export function generateTranscriptionJSON(
  sessions: DCSession[],
  speakerMap: Map<string, DCSpeaker>,
): string {
  const records = sessions
    .filter((s) => s.transcriptionStatus === "completed" || s.transcriptText)
    .map((s) => {
      const sp = speakerMap.get(s.speakerId);
      return {
        id: s.id,
        project_id: s.projectId,
        project_name: s.projectName,
        speaker_id: s.speakerId,
        speaker_name: s.speakerName,
        language: sp?.languages?.[0] ?? s.dialect,
        gender: sp?.gender ?? s.gender,
        age: sp?.age ?? s.age,
        age_group: sp?.ageGroup ?? "",
        country: sp?.country ?? "",
        region: sp?.region ?? s.region,
        prompt_text: s.promptText ?? null,
        verbatim_text: s.transcriptText,
        sample_rate_hz: s.sampleRate,
        bit_depth: s.bitDepth,
        duration_sec: s.duration,
        audio_url: s.audioUrl,
        wer_score: s.werScore,
        transcription_status: s.transcriptionStatus,
        created_at: formatTimestamp(s.createdAt),
      };
    });
  return JSON.stringify(records, null, 2);
}

// ─── ITN Annotation JSON ──────────────────────────────────────────────────────

export function generateITNJSON(
  sessions: DCSession[],
  speakerMap: Map<string, DCSpeaker>,
): string {
  const records = sessions
    .filter((s) => s.transcriptText)
    .map((s) => {
      const sp = speakerMap.get(s.speakerId);
      return {
        id: s.id,
        project_id: s.projectId,
        project_name: s.projectName,
        speaker_id: s.speakerId,
        speaker_name: s.speakerName,
        language: sp?.languages?.[0] ?? s.dialect,
        gender: sp?.gender ?? s.gender,
        age: sp?.age ?? s.age,
        country: sp?.country ?? "",
        region: sp?.region ?? s.region,
        prompt_text: s.promptText ?? null,
        verbatim_text: s.transcriptText,
        itn_text: s.transcriptText, // placeholder — to be post-processed
        sample_rate_hz: s.sampleRate,
        bit_depth: s.bitDepth,
        duration_sec: s.duration,
        audio_url: s.audioUrl,
        created_at: formatTimestamp(s.createdAt),
      };
    });
  return JSON.stringify(records, null, 2);
}

// ─── Delivery Tracking CSV ────────────────────────────────────────────────────

export function generateDeliveryCSV(sessions: DCSession[]): string {
  const headers = [
    "session_id", "project_id", "project_name",
    "speaker_id", "speaker_name",
    "prompt_text", "duration_sec", "sample_rate_hz",
    "audio_url", "file_path",
    "transcription_status", "verbatim_text",
    "qa_status", "qa_score", "qa_note",
    "created_at",
  ];
  const rows = sessions.map((s) =>
    csvRow([
      s.id, s.projectId, s.projectName,
      s.speakerId, s.speakerName,
      s.promptText ?? "", s.duration, s.sampleRate,
      s.audioUrl, s.filePath,
      s.transcriptionStatus, s.transcriptText,
      s.qaStatus, s.qaScore ?? "", s.qaNote,
      formatTimestamp(s.createdAt),
    ]),
  );
  return [headers.join(","), ...rows].join("\n");
}

// ─── QA Report CSV ────────────────────────────────────────────────────────────

export function generateQAReportCSV(
  sessions: DCSession[],
  speakerMap: Map<string, DCSpeaker>,
): string {
  const headers = [
    "session_id", "project_id", "project_name",
    "speaker_id", "speaker_name", "gender", "age",
    "language", "dialect",
    "prompt_text", "verbatim_text",
    "qa_status", "qa_score", "qa_note", "qa_reviewer",
    "audio_url", "duration_sec", "sample_rate_hz",
    "created_at",
  ];
  const rows = sessions.map((s) => {
    const sp = speakerMap.get(s.speakerId);
    return csvRow([
      s.id, s.projectId, s.projectName,
      s.speakerId, s.speakerName,
      sp?.gender ?? s.gender,
      sp?.age ?? s.age,
      sp?.languages?.[0] ?? s.dialect,
      s.dialect,
      s.promptText ?? "", s.transcriptText,
      s.qaStatus, s.qaScore ?? "", s.qaNote, s.qaReviewerEmail,
      s.audioUrl, s.duration, s.sampleRate,
      formatTimestamp(s.createdAt),
    ]);
  });
  return [headers.join(","), ...rows].join("\n");
}
