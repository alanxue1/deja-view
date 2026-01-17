"use client";

import React from "react";
import Container from "@/components/ui/Container";
import OverlayHeader from "@/components/overlay/OverlayHeader";
import FooterHints from "@/components/layout/FooterHints";
import Button from "@/components/ui/Button";
import RoomPreview from "@/components/three/RoomPreview";
import { MotionDiv, fadeInUp, defaultTransition } from "@/lib/motion";

export default function Home() {
  return (
    <main className="h-screen bg-[var(--bg)] flex flex-col overflow-hidden">
      <OverlayHeader overlay={false} />
      <div className="flex-1 flex flex-col min-h-0">
        <Container className="flex-1 flex flex-col py-6">
          {/* Hero Section - Setup instructions for new users */}
          <section className="grid grid-cols-12 gap-8 flex-1 min-h-0">
            {/* Left Column: Headline + Copy + CTA */}
            <MotionDiv
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={defaultTransition}
              className="col-span-12 md:col-span-6 flex flex-col justify-center"
            >
              {/* Headline */}
              <h1 className="text-4xl md:text-5xl font-serif text-[var(--ink)] leading-[1.1] mb-4 font-normal">
                Experience rooms in 3D before you visit
              </h1>
              
              {/* Setup / About copy */}
              <div className="space-y-2 mb-6 max-w-lg">
                <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed">
                  Deja View lets you explore spaces in immersive 3D. Sign in to
                  access your saved rooms and create new experiences.
                </p>
                <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed">
                  Returning users are taken straight to their virtual home. New
                  here? Get started below to create your account.
                </p>
              </div>
              
              {/* CTA - Clerk Sign In */}
              <div>
                <Button asChild href="/sign-in" variant="soft" className="text-base font-normal">
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
              className="col-span-12 md:col-span-6 flex items-center"
            >
              <RoomPreview />
            </MotionDiv>
          </section>

          {/* Footer Hints */}
          <FooterHints />
        </Container>
      </div>
    </main>
  );
}
