import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import HeroBackground from "@/components/hero-background";
import InvestmentSimulator from "@/components/investment-simulator";
import SiteFooter from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Simulador de Investimento",
  description:
    "Simule Start e Prime em 12 meses e compare aporte, cashback e crédito disponível dentro da estrutura AXE PRIME.",
  alternates: {
    canonical: "/simulador",
  },
};

export default function SimulatorPage() {
  return (
    <main className="simulator-page static-stage">
      <HeroBackground />
      <header className="site-header shell-panel">
        <Link href="/" className="brand" aria-label="AXE PRIME">
          <Image
            src="/brand/axe-prime-logotype.png"
            alt="AXE PRIME"
            width={172}
            height={54}
            className="brand-logo"
            priority
          />
        </Link>

        <Link href="/" className="secondary-button">
          <ArrowLeft size={18} strokeWidth={1.8} />
          Voltar ao início
        </Link>
      </header>

      <section className="simulator-shell">
        <div className="simulator-intro">
          <span className="eyebrow">Simulador</span>
          <h1 className="display-title simulator-title">Projete o comportamento de Start e Prime.</h1>
          <p className="lead simulator-lead">
            Ajuste o valor, leia o cashback mensal e compare as duas camadas com a mesma lógica
            de 12 meses.
          </p>
        </div>

        <InvestmentSimulator />
      </section>

      <SiteFooter />
    </main>
  );
}
