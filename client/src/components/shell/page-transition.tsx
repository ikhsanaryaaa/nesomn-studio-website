import { useLocation } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Animasi transisi halus antar route (DESIGN.md §9). */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={reduced ? false : { opacity: 1, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
      className="app-page-transition"
    >
      {children}
    </motion.div>
  );
}
