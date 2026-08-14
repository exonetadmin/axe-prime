import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página não encontrada",
  description: "A página que você buscou não foi encontrada.",
};

export default function NotFound() {
  return (
    <div className="not-found-shell">
      <div className="not-found-card">
        <Image
          src="/brand/axe-prime-emblem.png"
          alt="AXE PRIME"
          width={64}
          height={72}
          className="not-found-emblem"
        />
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">Página não encontrada.</h1>
        <p className="not-found-body">
          O endereço que você acessou não existe ou foi movido. Verifique o link
          ou volte ao início.
        </p>
        <div className="not-found-actions">
          <Link href="/" className="primary-button">
            Voltar ao início
          </Link>
          <Link href="/auth" className="secondary-button">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
