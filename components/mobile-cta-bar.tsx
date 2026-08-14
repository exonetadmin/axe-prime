"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function MobileCtaBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.6);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`mobile-cta-bar${visible ? " is-visible" : ""}`}
      aria-hidden={!visible}
    >
      <Link href="/auth?mode=register" className="primary-button mobile-cta-primary">
        Entrar para a estrutura
        <ArrowRight size={16} strokeWidth={1.8} />
      </Link>
      <Link href="/auth" className="secondary-button mobile-cta-secondary">
        Já tenho acesso
      </Link>
    </div>
  );
}
