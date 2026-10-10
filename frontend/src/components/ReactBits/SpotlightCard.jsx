// Adapted from React Bits by David Haz. See public/third-party-licenses.txt.
// Scoped pointer events keep large publication grids free of global listeners.
import { useRef } from 'react';

export default function SpotlightCard({
  as: Component = 'div', children, className = '', style,
  spotlightColor, onPointerMove, onFocus, ...props
}) {
  const ref = useRef(null);

  const handlePointerMove = (event) => {
    if (event.pointerType === 'mouse') {
      const rect = ref.current.getBoundingClientRect();
      ref.current.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`);
      ref.current.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`);
    }
    onPointerMove?.(event);
  };

  const handleFocus = (event) => {
    ref.current.style.setProperty('--spotlight-x', '50%');
    ref.current.style.setProperty('--spotlight-y', '50%');
    onFocus?.(event);
  };

  return (
    <Component
      ref={ref}
      className={`spotlight-card ${className}`}
      style={{ ...(spotlightColor ? { '--spotlight-color': spotlightColor } : {}), ...style }}
      onPointerMove={handlePointerMove}
      onFocus={handleFocus}
      {...props}
    >
      {children}
    </Component>
  );
}
