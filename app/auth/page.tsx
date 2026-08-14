import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth";
import { accessIconMap, authScreenCopy } from "@/lib/access-copy";
import HeroBackground from "@/components/hero-background";

import AuthPanel from "./auth-panel";

type AuthPageProps = {
  searchParams: Promise<{
    mode?: string;
    ref?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/portal");
  }

  const params = await searchParams;
  const initialMode = params.mode === "register" ? "register" : "login";
  const initialReferralCode =
    typeof params.ref === "string" && params.ref.trim() ? params.ref.trim() : undefined;

  return (
    <main className="auth-page auth-page-aurora">
      <HeroBackground />
      <header className="site-header shell-panel">
        <Link href="/" className="brand">
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

      <section className="auth-layout">
        <article className="auth-copy shell-panel">
          <div className="auth-copy-main">
            <span className="eyebrow">{authScreenCopy.eyebrow}</span>
            <h1 className="display-title auth-title">{authScreenCopy.title}</h1>
            <p className="lead auth-lead">{authScreenCopy.lead}</p>
          </div>

          <div className="auth-kpi-grid auth-kpi-grid-editorial">
            {authScreenCopy.cards.map(card => {
              const Icon = accessIconMap[card.icon];

              return (
                <div key={card.title} className="auth-kpi">
                  <Icon size={18} strokeWidth={1.8} />
                  <p className="metric-label">{card.title}</p>
                  <p className="metric-note">{card.body}</p>
                </div>
              );
            })}
          </div>

          <div className="story-card auth-guidance">
            <span className="section-label">{authScreenCopy.guidance.label}</span>
            <p className="content-card-body">{authScreenCopy.guidance.body}</p>
            <p className="auth-note">{authScreenCopy.guidance.note}</p>
          </div>
        </article>

        <div className="auth-form-shell">
          <AuthPanel
            initialMode={initialMode}
            initialReferralCode={initialReferralCode}
          />
        </div>
      </section>
    </main>
  );
}
