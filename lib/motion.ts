import { motion, type Variants, type Transition } from "framer-motion";
import { shouldUseMotion } from "./device";

/**
 * Motion variants that respect reduced motion preferences
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

/**
 * Default transition that respects motion preferences
 */
export const defaultTransition: Transition = {
  duration: shouldUseMotion() ? 0.6 : 0,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * Motion component wrapper that respects reduced motion
 */
export const MotionDiv = motion.div;
export const MotionSection = motion.section;
export const MotionSpan = motion.span;
