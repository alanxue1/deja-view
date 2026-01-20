"use client";

import React from "react";
import FooterHints from "@/components/layout/FooterHints";
import Button from "@/components/ui/Button";
import RoomPreview from "@/components/three/RoomPreview";
import DotGrid from "@/components/background/DotGrid";
import { MotionDiv, fadeInUp, defaultTransition } from "@/lib/motion";

export default function Home() {
  return (
    <main className="relative h-screen bg-[var(--bg)] flex flex-col overflow-hidden pt-20">
      {/* Background DotGrid */}
      <DotGrid
        dotSize={3}
        gap={24}
        baseColor="#D4D4D4"
        activeColor="#5227FF"
        proximity={120}
        shockRadius={200}
        shockStrength={3}
      />
      
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col py-6 px-6 md:px-[144px]">
          {/* Hero Section - Setup instructions for new users */}
          <section className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">
            {/* Left Column: Headline + Copy + CTA */}
            <MotionDiv
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={defaultTransition}
              className="flex-1 flex flex-col justify-center"
            >
              {/* Headline */}
              <h1 className="text-4xl md:text-5xl font-serif text-[var(--ink)] leading-[1.1] mb-6 font-normal">
                From inspiration to <em className="italic">identity</em>.
              </h1>
              
              {/* Hero copy */}
              <div className="space-y-3 mb-8 max-w-lg">
                <p className="text-base md:text-lg text-[var(--ink)] leading-relaxed">
                  What you save leaves a trace.
                </p>
                <p className="text-base md:text-lg text-[var(--ink)] leading-relaxed">
                  Déjà View brings it into your room as 3D,<br />
                  keep what you touch, let the rest fade.
                </p>
                <p className="text-base md:text-lg text-[var(--ink)] leading-relaxed font-medium">
                  Shop the pieces that truly belong.
                </p>
              </div>
              
              {/* CTA - Clerk Sign In */}
              <div>
                <Button asChild href="/sign-up" variant="primary" className="text-base font-normal">
                  Get started
                </Button>
              </div>
            </MotionDiv>

            {/* Right Column: Media Card */}
            <MotionDiv
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ ...defaultTransition, delay: 0.2 }}
              className="flex-[1.5] flex items-center"
            >
              <div className="w-full h-full rounded-[45px] overflow-hidden">
                <RoomPreview />
              </div>
            </MotionDiv>
          </section>

          {/* Footer Hints */}
          <FooterHints />
        </div>
      </div>
    </main>
  );
}
