// Adapted from React Bits by David Haz. See public/third-party-licenses.txt.
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

function buildKeyframes(from, steps) {
  const keys = new Set([...Object.keys(from), ...steps.flatMap((step) => Object.keys(step))]);
  return Object.fromEntries([...keys].map((key) => [key, [from[key], ...steps.map((step) => step[key])]]));
}

export default function BlurText({ text = '', as: Tag = 'p', id, className = '', delay = 65 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const reducedMotion = useReducedMotion();
  const words = text.split(' ');
  const from = useMemo(() => ({ filter: 'blur(6px)', opacity: 0, y: 12 }), []);
  const keyframes = useMemo(() => buildKeyframes(from, [
    { filter: 'blur(2px)', opacity: 0.7, y: 2 },
    { filter: 'blur(0px)', opacity: 1, y: 0 },
  ]), [from]);

  useEffect(() => {
    if (!ref.current || reducedMotion) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <Tag id={id} ref={ref} className={`blur-text ${className}`}>
      <span className="sr-only">{text}</span>
      {words.map((word, index) => (
        <motion.span
          key={`${index}-${word}`}
          aria-hidden="true"
          className="blur-text__word"
          initial={reducedMotion ? false : from}
          animate={reducedMotion ? { filter: 'none', opacity: 1, y: 0 } : (inView ? keyframes : from)}
          transition={{ duration: 0.55, delay: reducedMotion ? 0 : index * delay / 1000, times: [0, 0.5, 1], ease: 'easeOut' }}
        >
          {word}{index < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}
