import { useLocation } from 'react-router';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Animasi transisi halus antar route (DESIGN.md §9). */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
