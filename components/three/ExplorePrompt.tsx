"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ExplorePromptProps {
  visible: boolean;
}

export const ExplorePrompt: React.FC<ExplorePromptProps> = ({
  visible,
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none bg-black/[0.33]"
        >
          {/* Content container */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 1.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-6 select-none"
          >
            {/* Circle with dot animation */}
            <div className="relative w-16 h-16">
              {/* Outer circle - breathing animation */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/50"
                animate={{
                  scale: [1, 1.08, 1],
                  opacity: [0.5, 0.7, 0.5],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              
              {/* Inner static circle */}
              <div className="absolute inset-2 rounded-full border border-white/30" />
              
              {/* Center dot container - handles centering */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Center dot - pulsing */}
                <motion.div
                  className="w-2 h-2 rounded-full bg-white"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.9, 1, 0.9],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
              
              {/* Orbiting indicator dot */}
              <motion.div
                className="absolute w-1.5 h-1.5 rounded-full bg-white/70"
                style={{
                  top: "50%",
                  left: "50%",
                  marginTop: "-3px",
                  marginLeft: "-3px",
                }}
                animate={{
                  x: [0, 18, 0, -18, 0],
                  y: [-18, 0, 18, 0, -18],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            </div>

            {/* Text prompt */}
            <p className="font-serif text-lg text-white font-medium tracking-wide">
              Do you ever get déjà vu?
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExplorePrompt;
