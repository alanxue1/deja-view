"use client";

import React from "react";
import Container from "@/components/ui/Container";
import NavBar from "@/components/layout/NavBar";
import Divider from "@/components/ui/Divider";
import RoomPreview from "@/components/three/RoomPreview";
import Card from "@/components/ui/Card";
import Text from "@/components/ui/Text";
import { MotionDiv, fadeInUp, defaultTransition } from "@/lib/motion";

export default function RoomPage() {
  const items = [
    { id: 1, name: "Sofa", type: "Furniture" },
    { id: 2, name: "Coffee Table", type: "Furniture" },
    { id: 3, name: "Lamp", type: "Lighting" },
    { id: 4, name: "Rug", type: "Decor" },
  ];

  return (
    <main className="min-h-screen">
      <Container className="py-8">
        <NavBar />
        <Divider className="my-4" />

        <div className="mt-12">
          <h1 className="text-4xl font-serif text-[var(--ink)] mb-8">
            Room Viewer
          </h1>

          <div className="grid grid-cols-12 gap-8">
            {/* Left Column: Item List */}
            <MotionDiv
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={defaultTransition}
              className="col-span-12 md:col-span-4"
            >
              <Card className="p-6">
                <h2 className="text-xl font-serif text-[var(--ink)] mb-4">
                  Items
                </h2>
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="p-3 rounded-card border border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
                      data-cursor="hover"
                    >
                      <Text className="font-medium">{item.name}</Text>
                      <Text variant="small">{item.type}</Text>
                    </li>
                  ))}
                </ul>
              </Card>
            </MotionDiv>

            {/* Right Column: 3D Viewer */}
            <MotionDiv
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ ...defaultTransition, delay: 0.2 }}
              className="col-span-12 md:col-span-8"
            >
              <RoomPreview />
            </MotionDiv>
          </div>
        </div>
      </Container>
    </main>
  );
}
