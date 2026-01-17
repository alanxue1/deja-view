"use client";

import React from "react";
import Container from "@/components/ui/Container";
import NavBar from "@/components/layout/NavBar";
import FooterHints from "@/components/layout/FooterHints";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import Divider from "@/components/ui/Divider";
import RoomPreview from "@/components/three/RoomPreview";
import { MotionDiv, fadeInUp, defaultTransition } from "@/lib/motion";

export default function Home() {
  return (
    <main className="h-screen bg-[var(--bg)] flex flex-col overflow-hidden">
      <NavBar />
      <div className="flex-1 flex flex-col min-h-0">
        <Container className="flex-1 flex flex-col py-6">
          {/* Hero Section */}
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
                Lorem ipsum dolor
              </h1>
              
              {/* Body Copy - 4 lines */}
              <div className="space-y-2 mb-6 max-w-lg">
                <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed">
                  Lorem ipsum dolor sit amet consectetur adipiscing elit. Consectetur adipiscing elit quisque faucibus ex sapien vitae.
                </p>
                <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed">
                  Ex sapien vitae pellentesque sem placerat in id. Placerat in id cursus mi pretium tellus duis.
                </p>
                <p className="text-sm md:text-base text-[var(--ink)] leading-relaxed">
                  Pretium tellus duis convallis tempus leo eu aenean.
                </p>
              </div>
              
              {/* CTA Button */}
              <div>
                <Button variant="soft" className="text-base font-normal">
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
