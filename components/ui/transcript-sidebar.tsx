import { useMemo, useState, useRef, useEffect } from "react";
import { formatTime, transcriptToSrt, transcriptToVtt } from "@/lib/utils";
import { Button } from "./button";
import { Edit } from "lucide-react";

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
  mode: "word" | "phrase";
}

export function TranscriptSidebar({
  transcript,
  currentTime,
  setCurrentTime,
  onTranscriptUpdate,
  className = "",
  mode,
}: TranscriptSidebarProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const activeChunkRef = useRef<HTMLDivElement>(null);

  // Add effect to scroll to active chunk when currentTime changes
  useEffect(() => {
    if (activeChunkRef.current && transcriptContainerRef.current) {
      // Scroll the active chunk into view with smooth behavior
      activeChunkRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]);

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
    const srtContent = transcriptToSrt(transcript, mode);
    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVtt = () => {
    const vttContent = transcriptToVtt(transcript, mode);
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
      <div className="flex-1 overflow-y-auto" ref={transcriptContainerRef}>
        <div className="space-y-2 p-2">
          {transcript.chunks.map((chunk, i) => {
            const [start, end] = chunk.timestamp;
            const isActive = start <= currentTime && currentTime < end;
            const isEditing = editingIndex === i;

            return (
              <div
                key={i}
                ref={isActive ? activeChunkRef : null}
                className={`p-2 rounded ${
                  isEditing ? "bg-muted" : "hover:bg-muted cursor-pointer"
                } transition-colors ${
                  isActive && !isEditing
                    ? "bg-muted border-l-4 border-black"
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
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEdit();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveEdit();
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <p className={isActive ? "font-medium" : ""}>
                      {chunk.text}
                    </p>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(i);
                      }}
                      className="ml-2 p-1 "
                      title="Edit text"
                      size={"icon"}
                    >
                      <Edit />
                    </Button>
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
          <Button
            onClick={handleDownloadJson}
            className="flex items-center justify-center gap-1 px-3 py-2 "
          >
            <Edit />
            JSON
          </Button>

          <Button
            onClick={handleDownloadSrt}
            className="flex items-center justify-center gap-1 px-3 py-2 "
          >
            <Edit />
            SRT
          </Button>

          <Button
            onClick={handleDownloadVtt}
            className="flex items-center justify-center gap-1 px-3 py-2  col-span-2"
          >
            <Edit />
            WebVTT
          </Button>
        </div>
      </div>
    </div>
  );
}
