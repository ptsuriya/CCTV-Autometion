// Adapted from the open-source React Bits BlurText component.
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

const buildKeyframes = (from, steps) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap((step) => Object.keys(step))]);
  return Object.fromEntries([...keys].map((key) => [key, [from[key], ...steps.map((step) => step[key])]]));
};

export default function BlurText({ text = '', delay = 90, className = '', direction = 'top' }) {
  const segments = text.split(' ');
  const [inView, setInView] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(ref.current);
      }
    }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const from = useMemo(() => direction === 'top'
    ? { filter: 'blur(10px)', opacity: 0, y: -22 }
    : { filter: 'blur(10px)', opacity: 0, y: 22 }, [direction]);
  const steps = useMemo(() => [
    { filter: 'blur(4px)', opacity: 0.55, y: direction === 'top' ? 3 : -3 },
    { filter: 'blur(0px)', opacity: 1, y: 0 },
  ], [direction]);
  const keyframes = buildKeyframes(from, steps);
  return (
    <p ref={ref} className={`flex flex-wrap ${className}`}>
      {segments.map((segment, index) => (
        <motion.span
          key={`${segment}-${index}`}
          className="inline-block will-change-[transform,filter,opacity]"
          initial={from}
          animate={inView ? keyframes : from}
          transition={{ duration: 0.7, times: [0, 0.5, 1], delay: (index * delay) / 1000, ease: 'easeOut' }}
        >
          {segment}{index < segments.length - 1 ? '\u00a0' : ''}
        </motion.span>
      ))}
    </p>
  );
}
