'use client';

import { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
}

export function Typewriter({ text, className = '', speed = 80, delay = 0, cursor = true }: TypewriterProps) {
  const [display, setDisplay] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const start = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(start);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (display.length >= text.length) return;
    const t = setTimeout(() => setDisplay(text.slice(0, display.length + 1)), speed);
    return () => clearTimeout(t);
  }, [started, display, text, speed]);

  const showCursor = cursor && display.length < text.length;

  return (
    <span className={className}>
      {display}
      {showCursor && <span className="animate-pulse opacity-80">|</span>}
    </span>
  );
}
