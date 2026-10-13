// Adapted from React Bits by David Haz. See public/third-party-licenses.txt.
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const INITIAL_STYLES = { filter: 'blur(6px)', opacity: 0, y: 12 };
const REVEAL_KEYFRAMES = {
  filter: ['blur(6px)', 'blur(2px)', 'blur(0px)'],
  opacity: [0, 0.7, 1],
  y: [12, 2, 0],
};

export default function BlurText({ text = '', as: Tag = 'p', id, className = '', delay = 65 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const reducedMotion = useReducedMotion();
  const words = text.split(' ');

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
          initial={reducedMotion ? false : INITIAL_STYLES}
          animate={reducedMotion ? { filter: 'none', opacity: 1, y: 0 } : (inView ? REVEAL_KEYFRAMES : INITIAL_STYLES)}
          transition={{ duration: 0.55, delay: reducedMotion ? 0 : index * delay / 1000, times: [0, 0.5, 1], ease: 'easeOut' }}
        >
          {word}{index < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}
