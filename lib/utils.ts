import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format seconds into a readable time format (MM:SS)
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Format seconds into SRT timestamp format (HH:MM:SS,MS)
 */
export function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Format seconds into WebVTT timestamp format (HH:MM:SS.MS)
 */
export function formatVttTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Convert transcript data to SRT format
 */
export function transcriptToSrt(transcript: {
  chunks: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}): string {
  return transcript.chunks
    .map((chunk, index) => {
      const [start, end] = chunk.timestamp;
      return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(
        end
      )}\n${chunk.text}\n`;
    })
    .join("\n");
}

/**
 * Convert transcript data to WebVTT format
 */
export function transcriptToVtt(transcript: {
  chunks: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}): string {
  const header = "WEBVTT\n\n";
  const cues = transcript.chunks
    .map((chunk, index) => {
      const [start, end] = chunk.timestamp;
      return `${index + 1}\n${formatVttTime(start)} --> ${formatVttTime(
        end
      )}\n${chunk.text}\n`;
    })
    .join("\n");

  return header + cues;
}
