"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function ScrollIndicator() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY < 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <a
      href="#beneficios"
      className="scroll-indicator"
      aria-label="Rolar para próxima seção"
    >
      <span className="scroll-indicator-text">Explorar</span>
      <ChevronDown size={18} strokeWidth={1.8} className="scroll-indicator-icon" />
    </a>
  );
}
