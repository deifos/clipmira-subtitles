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
 * Process transcript chunks according to the mode (word/phrase)
 */
export function processTranscriptChunks(
  transcript: {
    chunks: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  },
  mode: "word" | "phrase" = "word"
): Array<{
  text: string;
  timestamp: [number, number];
}> {
  if (mode === "word") {
    return transcript.chunks;
  }

  // For phrase mode, combine chunks that are close in time
  const processedChunks: Array<{
    text: string;
    timestamp: [number, number];
  }> = [];

  let currentGroup: {
    texts: string[];
    start: number;
    end: number;
  } | null = null;

  transcript.chunks.forEach((chunk, index) => {
    const [start, end] = chunk.timestamp;
    const text = chunk.text.trim();

    if (!text) return; // Skip empty chunks

    if (!currentGroup) {
      currentGroup = {
        texts: [text],
        start,
        end,
      };
    } else {
      // If the gap between chunks is small enough (0.3s), combine them
      if (start - currentGroup.end <= 0.3) {
        currentGroup.texts.push(text);
        currentGroup.end = end;
      } else {
        // Gap is too large, create a new group
        processedChunks.push({
          text: currentGroup.texts.join(" "),
          timestamp: [currentGroup.start, currentGroup.end],
        });
        currentGroup = {
          texts: [text],
          start,
          end,
        };
      }
    }

    // If this is the last chunk, add the current group
    if (index === transcript.chunks.length - 1 && currentGroup) {
      processedChunks.push({
        text: currentGroup.texts.join(" "),
        timestamp: [currentGroup.start, currentGroup.end],
      });
    }
  });

  return processedChunks;
}

/**
 * Convert transcript data to SRT format
 */
export function transcriptToSrt(
  transcript: {
    chunks: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  },
  mode: "word" | "phrase" = "word"
): string {
  const processedChunks = processTranscriptChunks(transcript, mode);
  return processedChunks
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
export function transcriptToVtt(
  transcript: {
    chunks: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  },
  mode: "word" | "phrase" = "word"
): string {
  const header = "WEBVTT\n\n";
  const processedChunks = processTranscriptChunks(transcript, mode);
  const cues = processedChunks
    .map((chunk, index) => {
      const [start, end] = chunk.timestamp;
      return `${index + 1}\n${formatVttTime(start)} --> ${formatVttTime(
        end
      )}\n${chunk.text}\n`;
    })
    .join("\n");

  return header + cues;
}
