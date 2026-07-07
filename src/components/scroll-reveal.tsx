"use client";

import {
  Children,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Animation = "fade-up" | "fade-in" | "fade-scale" | "fade-left" | "fade-right";

interface ScrollRevealProps {
  children: ReactNode;
  animation?: Animation;
  delay?: number;
  duration?: number;
  className?: string;
  /** If true, stays visible after first reveal. Default false = animates in/out on scroll. */
  once?: boolean;
}

const hiddenTransforms: Record<Animation, string> = {
  "fade-up": "translateY(40px)",
  "fade-in": "translateY(12px)",
  "fade-scale": "scale(0.94)",
  "fade-left": "translateX(-40px)",
  "fade-right": "translateX(40px)",
};

export function ScrollReveal({
  children,
  animation = "fade-up",
  delay = 0,
  duration = 900,
  className = "",
  once = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    let observer: IntersectionObserver | null = null;

    const startObserving = () => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) obs.unobserve(el);
          } else if (!once) {
            setVisible(false);
          }
        },
        {
          threshold: 0.18,
          rootMargin: "0px 0px -40px 0px",
        },
      );

      observer = obs;
      obs.observe(el);
    };

    // Defer until after layout so below-the-fold elements are not
    // falsely marked visible on the initial paint.
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(startObserving);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [once]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : hiddenTransforms[animation],
        transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  staggerMs?: number;
  animation?: Animation;
  once?: boolean;
}

export function ScrollRevealStagger({
  children,
  className = "",
  staggerMs = 120,
  animation = "fade-up",
  once = false,
}: StaggerProps) {
  const items = Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, i) => (
        <ScrollReveal
          key={i}
          animation={animation}
          delay={i * staggerMs}
          once={once}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}
