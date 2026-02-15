'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

type Section3DProps = {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  id?: string;
};

export function Section3D({ children, className = '', as: Tag = 'section', id }: Section3DProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px', amount: 0.2 });

  return (
    <Tag ref={ref as React.RefObject<HTMLElement>} id={id} className={className}>
      <motion.div
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, rotateX: 18, transformPerspective: 1200 }}
        animate={
          isInView
            ? { opacity: 1, rotateX: 0, transformPerspective: 1200 }
            : { opacity: 0, rotateX: 18, transformPerspective: 1200 }
        }
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </Tag>
  );
}
