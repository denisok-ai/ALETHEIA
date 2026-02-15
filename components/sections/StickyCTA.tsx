'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function StickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById('hero');
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      setVisible(rect.bottom < 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2 md:bottom-10"
        >
          <Link href="#pricing">
            <Button
              variant="primary"
              size="lg"
              className="shadow-[0_0_32px_rgba(166,139,91,0.35)] hover:shadow-[0_0_48px_rgba(166,139,91,0.45)]"
            >
              Купить курс
            </Button>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
