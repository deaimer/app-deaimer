export { worldLanguageOptions as dcLanguageOptions } from "@/lib/firebase/global-workforce-jobs";

export const dcProjectTypeOptions = [
  "Data Collection: Audio",
  "Data Collection: Text",
  "Data Collection: Video",
  "Data Collection: Image",
  "Data Collection: Multi-modal",
  "Annotation: Audio",
  "Annotation: Text",
  "Annotation: Image",
  "Annotation: Video",
  "RLHF",
  "QA Validation",
] as const;

export const dcAppOptions = [
  "iOS",
  "Android",
  "Web Browser",
  "Desktop (Windows)",
  "Desktop (Mac)",
  "Physical Recording Device",
] as const;

export const dcAudioFormatOptions = ["WAV", "MP3", "FLAC", "OGG", "M4A"] as const;
export const dcBitDepthOptions = ["8-bit", "16-bit PCM", "24-bit", "32-bit float"] as const;
export const dcSampleRateOptions = ["8kHz", "16kHz", "22.05kHz", "44.1kHz", "48kHz", "96kHz"] as const;
