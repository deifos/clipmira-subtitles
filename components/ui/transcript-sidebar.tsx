import { useMemo, useState } from "react";
import { formatTime, transcriptToSrt, transcriptToVtt } from "@/lib/utils";

interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
}

interface TranscriptSidebarProps {
  transcript: {
    text: string;
    chunks: TranscriptChunk[];
  };
  currentTime: number;
  setCurrentTime: (time: number) => void;
  onTranscriptUpdate?: (updatedTranscript: {
    text: string;
    chunks: TranscriptChunk[];
  }) => void;
  className?: string;
}

export function TranscriptSidebar({
  transcript,
  currentTime,
  setCurrentTime,
  onTranscriptUpdate,
  className = "",
}: TranscriptSidebarProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const jsonTranscript = useMemo(() => {
    return JSON.stringify(transcript, null, 2).replace(
      /( {4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm,
      "$1[$2 $3]"
    );
  }, [transcript]);

  const handleDownloadJson = () => {
    const blob = new Blob([jsonTranscript], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = () => {
    const srtContent = transcriptToSrt(transcript);
    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVtt = () => {
    const vttContent = transcriptToVtt(transcript);
    const blob = new Blob([vttContent], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.vtt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditText(transcript.chunks[index].text);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;

    // Create a new transcript object with the updated chunk
    const updatedChunks = [...transcript.chunks];
    updatedChunks[editingIndex] = {
      ...updatedChunks[editingIndex],
      text: editText,
    };

    const updatedTranscript = {
      text: updatedChunks.map((chunk) => chunk.text).join(" "),
      chunks: updatedChunks,
    };

    // Call the update function if provided
    if (onTranscriptUpdate) {
      onTranscriptUpdate(updatedTranscript);
    }

    // Reset editing state
    setEditingIndex(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-2">
          {transcript.chunks.map((chunk, i) => {
            const [start, end] = chunk.timestamp;
            const isActive = start <= currentTime && currentTime < end;
            const isEditing = editingIndex === i;

            return (
              <div
                key={i}
                className={`p-2 rounded ${
                  isEditing ? "bg-muted" : "hover:bg-muted cursor-pointer"
                } transition-colors ${
                  isActive && !isEditing
                    ? "bg-muted border-l-4 border-primary"
                    : ""
                }`}
                onClick={() => {
                  if (!isEditing) {
                    setCurrentTime(start);
                  }
                }}
              >
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{formatTime(start)}</span>
                  <span>{formatTime(end)}</span>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-2 border rounded-md text-sm min-h-[60px]"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEdit();
                        }}
                        className="px-2 py-1 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveEdit();
                        }}
                        className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <p className={isActive ? "font-medium" : ""}>
                      {chunk.text}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(i);
                      }}
                      className="ml-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Edit text"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t p-4 space-y-2">
        <div className="text-sm font-medium mb-2">Export Subtitles</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadJson}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            JSON
          </button>

          <button
            onClick={handleDownloadSrt}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 text-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            SRT
          </button>

          <button
            onClick={handleDownloadVtt}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 text-sm col-span-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            WebVTT
          </button>
        </div>
      </div>
    </div>
  );
}
