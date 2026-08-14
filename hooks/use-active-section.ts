'use client';

import { useEffect, useState } from 'react';

export function useActiveSection(sectionIds: string[], offset = 100) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const observers = new Map<string, IntersectionObserver>();

    const handleObserve = (id: string) => (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        setActiveSection(id);
      }
    };

    sectionIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        const observer = new IntersectionObserver(handleObserve(id), {
          rootMargin: `-${offset}px 0px -50% 0px`,
          threshold: 0,
        });
        observer.observe(element);
        observers.set(id, observer);
      }
    });

    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [sectionIds, offset]);

  return activeSection;
}
