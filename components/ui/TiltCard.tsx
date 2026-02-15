'use client';

import { useRef, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}

export function TiltCard({ children, className, maxTilt = 12 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [hover, setHover] = useState(false);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    x.set(dy * maxTilt);
    y.set(-dx * maxTilt);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
    setHover(false);
  };

  const transform = useMotionTemplate`perspective(800px) rotateX(${x}deg) rotateY(${y}deg) scale(${hover ? 1.02 : 1})`;

  return (
    <motion.div
      ref={ref}
      className={cn('transition-shadow duration-300', className)}
      style={{ transform }}
      onMouseMove={handleMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={handleLeave}
      whileHover={{ boxShadow: '0 25px 50px -12px rgba(166, 139, 91, 0.2)' }}
    >
      {children}
    </motion.div>
  );
}
