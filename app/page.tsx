"use client";

import React from "react";
import Container from "@/components/ui/Container";
import FooterHints from "@/components/layout/FooterHints";
import Button from "@/components/ui/Button";
import RoomPreview from "@/components/three/RoomPreview";
import { MotionDiv, fadeInUp, defaultTransition } from "@/lib/motion";

export default function Home() {
  return (
    <main className="relative h-screen bg-[var(--bg)] flex flex-col overflow-hidden pt-20">
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <Container className="flex-1 flex flex-col py-6">
          {/* Hero Section - Setup instructions for new users */}
          <section className="grid grid-cols-12 gap-8 flex-1 min-h-0">
            {/* Left Column: Headline + Copy + CTA */}
            <MotionDiv
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={defaultTransition}
              className="col-span-12 md:col-span-5 lg:col-span-4 flex flex-col justify-center"
            >
              {/* Headline */}
              <h1 className="text-4xl md:text-5xl font-serif text-[var(--ink)] leading-[1.1] mb-4 font-normal">
                From inspiration to identity
              </h1>
              
              {/* Setup / About copy */}
              <div className="space-y-2 mb-6 max-w-lg">
                <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed">
                  Deja View transforms products you discover on social media into 3D objects. Curate your finds, visualize them in your personal space, and shop directly through Shopify.
                </p>
                <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed">
                  Your room becomes your identity. Build a space that reflects who you are and what you love.
                </p>
              </div>
              
              {/* CTA - Clerk Sign In */}
              <div>
                <Button asChild href="/sign-in" variant="primary" className="text-base font-normal">
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
              className="col-span-12 md:col-span-7 lg:col-span-8 flex items-center"
            >
              <div className="w-full h-full rounded-[45px] overflow-hidden">
                <RoomPreview />
              </div>
            </MotionDiv>
          </section>

          {/* Footer Hints */}
          <FooterHints />
        </Container>
      </div>
    </main>
  );
}
