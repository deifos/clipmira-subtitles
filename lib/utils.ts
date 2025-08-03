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
      disabled?: boolean;
    }>;
  },
  mode: "word" | "phrase" = "word"
): Array<{
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
  words?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}> {
  if (mode === "word") {
    return transcript.chunks;
  }

  // For phrase mode, create shorter, more readable phrases
  const processedChunks: Array<{
    text: string;
    timestamp: [number, number];
    disabled?: boolean;
    words: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  }> = [];

  let currentGroup: {
    texts: string[];
    words: Array<{
      text: string;
      timestamp: [number, number];
    }>;
    start: number;
    end: number;
  } | null = null;

  const MAX_PHRASE_WORDS = 6; // Limit phrases to 6 words max
  const MAX_PHRASE_DURATION = 3.0; // Limit phrases to 3 seconds max
  const MAX_GAP = 0.5; // Slightly larger gap tolerance

  transcript.chunks.forEach((chunk, index) => {
    const [start, end] = chunk.timestamp;
    const text = chunk.text.trim();

    if (!text) return; // Skip empty chunks

    const wordData = { text, timestamp: [start, end] as [number, number] };

    if (!currentGroup) {
      currentGroup = {
        texts: [text],
        words: [wordData],
        start,
        end,
      };
    } else {
      const timeSinceLastWord = start - currentGroup.end;
      const currentDuration = currentGroup.end - currentGroup.start;
      const wouldExceedWordLimit = currentGroup.texts.length >= MAX_PHRASE_WORDS;
      const wouldExceedDuration = (end - currentGroup.start) > MAX_PHRASE_DURATION;
      
      // Check if we should end the current phrase
      const shouldEndPhrase = 
        timeSinceLastWord > MAX_GAP || 
        wouldExceedWordLimit || 
        wouldExceedDuration ||
        // End phrase at natural breaks (punctuation)
        /[.!?]$/.test(currentGroup.texts[currentGroup.texts.length - 1]) ||
        // End phrase at commas if we already have 3+ words
        (/[,;:]$/.test(currentGroup.texts[currentGroup.texts.length - 1]) && currentGroup.texts.length >= 3);

      if (shouldEndPhrase) {
        // End current phrase and start a new one
        processedChunks.push({
          text: currentGroup.texts.join(" "),
          timestamp: [currentGroup.start, currentGroup.end],
          words: currentGroup.words,
        });
        currentGroup = {
          texts: [text],
          words: [wordData],
          start,
          end,
        };
      } else {
        // Continue building current phrase
        currentGroup.texts.push(text);
        currentGroup.words.push(wordData);
        currentGroup.end = end;
      }
    }

    // If this is the last chunk, add the current group
    if (index === transcript.chunks.length - 1 && currentGroup) {
      processedChunks.push({
        text: currentGroup.texts.join(" "),
        timestamp: [currentGroup.start, currentGroup.end],
        words: currentGroup.words,
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
