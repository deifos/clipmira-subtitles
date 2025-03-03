"use client";

import { useRef, useState } from "react";
import { VideoUpload } from "@/components/ui/video-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  Download,
  Video,
  Edit,
  Clock,
  Globe,
  Zap,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { TranscriptSidebar } from "@/components/ui/transcript-sidebar";
import {
  SubtitleStyling,
  SubtitleStyle,
} from "@/components/ui/subtitle-styling";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { useTranscription, STATUS_MESSAGES } from "@/hooks/useTranscription";
import { useVideoDownload } from "@/hooks/useVideoDownload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Default subtitle style
const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: "Arial, sans-serif",
  fontSize: 42,
  fontWeight: "900",
  color: "#CCCCCC", // Silver metallic color
  backgroundColor: "transparent", // No background
  borderWidth: 2,
  borderColor: "#000000", // Black border
};

export default function Home() {
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
    DEFAULT_SUBTITLE_STYLE
  );
  const [uploadKey, setUploadKey] = useState(0);
  const [showApp, setShowApp] = useState(false);
  const [mode, setMode] = useState<"word" | "phrase">("word");
  const [ratio, setRatio] = useState<"16:9" | "9:16">("16:9");
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    status,
    error,
    result,
    progress,
    setResult,
    setStatus,
    setProgress,
    handleVideoSelect,
    resetTranscription,
  } = useTranscription();

  const { handleDownloadVideo } = useVideoDownload({
    videoRef,
    result,
    subtitleStyle,
    setStatus,
    setProgress,
    mode,
    ratio,
  });

  // Function to handle video reset and upload another
  const handleResetVideo = () => {
    // Reset transcription state
    resetTranscription();

    // Reset current time
    setCurrentTime(0);

    // Increment key to force VideoUpload component to remount
    setUploadKey((prev) => prev + 1);

    // Reset video element
    if (videoRef.current) {
      // First pause the video to prevent any issues
      videoRef.current.pause();
      // Clear the source
      videoRef.current.removeAttribute("src");
      // Force the browser to release any object URLs
      videoRef.current.load();
    }
  };

  // Function to show the app and hide the landing page content
  const handleTryNow = () => {
    setShowApp(true);
  };

  // Function to go back to the landing page
  const handleBackToLanding = () => {
    setShowApp(false);
  };

  // Determine if we should show the loading overlay
  const isProcessing = status !== "idle" && status !== "ready";

  // Render the app or landing page based on showApp state
  if (showApp) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center relative ">
        {/* App Section */}
        <section className="w-full py-8">
          <div className=" mx-auto px-4 md:px-6">
            <div className="w-full mx-auto space-y-6 p-6 md:p-8 rounded-xl border border-border/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Button
                    variant="default"
                    size="icon"
                    onClick={handleBackToLanding}
                    className="rounded-full"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">Subtitle Generator</h3>
                    <p className="text-muted-foreground">
                      Upload a video (MP4 or WebM) to generate subtitles using
                      AI 100% local
                    </p>
                  </div>
                </div>

                {result && (
                  <Button
                    onClick={handleResetVideo}
                    className="flex items-center gap-2 px-4 py-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Another Video
                  </Button>
                )}
              </div>

              {!result && (
                <Alert className="">
                  <Video className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    Supported formats: MP4 and WebM. Maximum video length: 5
                    minutes.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col lg:flex-row gap-6">
                {/* Subtitle Styling Column - Only show when we have a result */}
                {result && (
                  <div className="w-full lg:w-96 h-[500px]">
                    <ScrollArea className="rounded-base h-[500px] w-full text-mtext border-2 border-border bg-main p-2 shadow-shadow">
                      <div className="p-2">
                        <SubtitleStyling
                          style={subtitleStyle}
                          onChange={setSubtitleStyle}
                        />
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Video Column */}
                <div className="flex-1 flex flex-col">
                  <VideoUpload
                    key={uploadKey}
                    className="w-full"
                    onVideoSelect={handleVideoSelect}
                    ref={videoRef}
                    onTimeUpdate={(time) => setCurrentTime(time)}
                    transcript={result}
                    currentTime={currentTime}
                    subtitleStyle={subtitleStyle}
                    mode={mode}
                    onModeChange={setMode}
                    ratio={ratio}
                    onRatioChange={setRatio}
                  />

                  {result && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        onClick={handleDownloadVideo}
                        className="flex items-center gap-2"
                        disabled={isProcessing}
                      >
                        <Download className="w-4 h-4" />
                        Download Video with Subtitles
                      </Button>
                    </div>
                  )}
                </div>

                {/* Transcript Column */}
                {result && (
                  <div className="w-full lg:w-96 h-[500px]">
                    <ScrollArea className="rounded-base h-[500px] w-full text-mtext border-2 border-border bg-main p-4 shadow-shadow">
                      <div className="mb-4 pb-2 border-b border-border">
                        <h4 className="text-lg font-semibold">
                          Edit Transcript
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Click on any segment to edit the text
                        </p>
                      </div>
                      <TranscriptSidebar
                        transcript={result}
                        currentTime={currentTime}
                        setCurrentTime={(time) => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = time;
                            setCurrentTime(time);
                          }
                        }}
                        onTranscriptUpdate={(updatedTranscript) => {
                          setResult(updatedTranscript);
                        }}
                        mode={mode}
                      />
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Processing Overlay */}
        <ProcessingOverlay
          isVisible={isProcessing}
          statusMessage={STATUS_MESSAGES[status]}
          progress={progress}
        />
      </main>
    );
  }

  // Landing Page
  return (
    <main className="flex min-h-screen flex-col items-center relative">
      {/* Hero Section */}
      <section className="w-full bg-gradient-to-r from-primary/10 to-primary/5 py-20">
        <div className="container mx-auto px-4 md:px-6 flex flex-col items-center text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Clipmira <span className="text-primary">Subtitle Generator</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl">
            Transform your videos with accurate, customizable subtitles powered
            by AI. No more tedious manual transcription or expensive services.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Button size="lg" onClick={handleTryNow} className="text-lg px-8">
              Try It Now
            </Button>
            <Button size="lg" variant="default" className="text-lg px-8">
              Learn More
            </Button>
          </div>
          <Alert className="mt-8 max-w-lg mx-auto ">
            <Video className="h-4 w-4 text-primary" />
            <AlertDescription>
              Supported formats: MP4 and WebM. Maximum video length: 5 minutes.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-20 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose Our Subtitle Generator?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our AI-powered tool solves the biggest challenges in video
              subtitling
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader className="pb-2">
                <Clock className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Save Hours of Work</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Generate accurate subtitles in minutes instead of spending
                  hours on manual transcription. Focus on creating content, not
                  typing.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader className="pb-2">
                <Edit className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Full Customization</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Customize font, size, color, and background to match your
                  brand and ensure readability across all devices and platforms.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader className="pb-2">
                <Globe className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Reach Global Audience</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Make your content accessible to everyone, including viewers
                  with hearing impairments and international audiences.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader className="pb-2">
                <Zap className="h-12 w-12 text-primary mb-2" />
                <CardTitle>AI-Powered Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Our advanced AI model ensures high-quality transcription with
                  proper punctuation and speaker recognition.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader className="pb-2">
                <Video className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Embedded Subtitles</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Download your video with permanently embedded subtitles, ready
                  to upload to any platform without compatibility issues.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader className="pb-2">
                <CheckCircle className="h-12 w-12 text-primary mb-2" />
                <CardTitle>Easy Editing</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Fine-tune your transcript with our intuitive editor. Correct
                  any words or timing with just a few clicks.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonial/CTA Section */}
      <section className="w-full py-20 bg-primary/5">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Enhance Your Videos?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Join thousands of content creators who save time and reach wider
            audiences with our subtitle generator.
          </p>
          <Button size="lg" onClick={handleTryNow} className="text-lg px-8">
            Get Started Now
          </Button>
        </div>
      </section>
    </main>
  );
}
