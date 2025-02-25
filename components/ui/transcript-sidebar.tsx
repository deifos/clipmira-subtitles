import { useMemo } from "react";
import { formatTime } from "@/lib/utils";

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
  className?: string;
}

export function TranscriptSidebar({
  transcript,
  currentTime,
  setCurrentTime,
  className = "",
}: TranscriptSidebarProps) {
  const jsonTranscript = useMemo(() => {
    return JSON.stringify(transcript, null, 2).replace(
      /( {4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm,
      "$1[$2 $3]"
    );
  }, [transcript]);

  const handleDownload = () => {
    const blob = new Blob([jsonTranscript], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-2">
          {transcript.chunks.map((chunk, i) => {
            const [start, end] = chunk.timestamp;
            const isActive = start <= currentTime && currentTime < end;

            return (
              <div
                key={i}
                className={`p-2 rounded cursor-pointer hover:bg-muted transition-colors ${
                  isActive ? "bg-muted border-l-4 border-primary" : ""
                }`}
                onClick={() => setCurrentTime(start)}
              >
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{formatTime(start)}</span>
                  <span>{formatTime(end)}</span>
                </div>
                <p className={isActive ? "font-medium" : ""}>{chunk.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t p-4">
        <button
          onClick={handleDownload}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Download transcript
        </button>
      </div>
    </div>
  );
}
