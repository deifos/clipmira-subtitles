"use client";

import { useState } from "react";
import { LandingPage } from "@/components/ui/landing-page";
import { MainApp } from "@/components/ui/main-app";

export default function Home() {
  const [showApp, setShowApp] = useState(true); // Skip landing page and go straight to app

  // Function to show the app and hide the landing page content
  const handleTryNow = () => {
    setShowApp(true);
  };

  // Render the app or landing page based on showApp state
  if (showApp) {
    return <MainApp />;
  }

  // Landing Page
  return <LandingPage onTryNow={handleTryNow} />;
}