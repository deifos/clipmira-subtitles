import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Video,
  Edit,
  Clock,
  Globe,
  Zap,
  CheckCircle,
} from "lucide-react";

interface LandingPageProps {
  onTryNow: () => void;
}

export function LandingPage({ onTryNow }: LandingPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center relative">
      {/* Hero Section */}
      <section className="w-full bg-gradient-to-r from-primary/10 to-primary/5 py-20">
        <div className="container mx-auto px-4 md:px-6 flex flex-col items-center text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Based Subtitles
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl">
            Transform your videos with accurate, customizable subtitles powered
            by AI. No more tedious manual transcription or expensive services.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Button size="lg" onClick={onTryNow} className="text-lg px-8">
              Try It Now
            </Button>
            <Button size="lg" variant="default" className="text-lg px-8">
              Learn More
            </Button>
          </div>
          <Alert className="mt-8 max-w-lg mx-auto">
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
          <Button size="lg" onClick={onTryNow} className="text-lg px-8">
            Get Started Now
          </Button>
        </div>
      </section>
    </main>
  );
}