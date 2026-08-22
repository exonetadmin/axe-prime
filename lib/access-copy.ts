import type { LucideIcon } from "lucide-react";
import { Bell, Layers3, Mail, ShieldCheck, UserCheck } from "lucide-react";

export type AccessIconKey = "shield-check" | "user-check" | "layers-3" | "mail" | "bell";

export type AccessCardCopy = {
  title: string;
  body: string;
  icon: AccessIconKey;
};

export type AuthModeKey = "login" | "register" | "reset" | "new-password";

export type AuthModeCopy = {
  title: string;
  description: string;
  submitLabel: string;
  secondaryLabel?: string;
};

export type AuthScreenCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  cards: [AccessCardCopy, AccessCardCopy];
  guidance: {
    label: string;
    body: string;
    note: string;
  };
  panelLabel: string;
  tabs: {
    login: string;
    register: string;
  };
  footerNote: string;
  registerSponsorCode: {
    label: string;
    placeholder: string;
    requiredError: string;
  };
  modes: Record<AuthModeKey, AuthModeCopy>;
};

export type PortalScreenCopy = {
  welcomeCopy: string;
  profileLabels: {
    plan: string;
    status: string;
    email: string;
  };
  nextSteps: [string, string, string, string];
  compactCards: [AccessCardCopy, AccessCardCopy, AccessCardCopy];
  network?: {
    title: string;
    body: string;
  };
};

export const accessIconMap: Record<AccessIconKey, LucideIcon> = {
  "shield-check": ShieldCheck,
  "user-check": UserCheck,
  "layers-3": Layers3,
  mail: Mail,
  bell: Bell,
};

export const authScreenCopy: AuthScreenCopy = {
  eyebrow: "Entrada reservada",
  title: "O próximo passo pede critério, não pressa.",
  lead: "Se você já faz parte da AXE PRIME, entre. Se está começando agora, crie seu acesso e siga com a orientação correta.",
  cards: [
    {
      icon: "shield-check",
      title: "Confidencialidade",
      body: "Dados, autenticação e continuidade tratados com reserva.",
    },
    {
      icon: "user-check",
      title: "Entrada com critério",
      body: "A jornada começa pela leitura do seu momento patrimonial e da camada mais aderente.",
    },
  ],
  guidance: {
    label: "Como funciona",
    body: "Quem já tem cadastro entra com e-mail e senha. Quem está começando cria seu acesso e informa o interesse inicial.",
    note: "Clareza primeiro. Continuidade depois.",
  },
  panelLabel: "Seu acesso",
  tabs: {
    login: "Entrar",
    register: "Criar acesso",
  },
  footerNote:
    "Seus dados são utilizados exclusivamente para autenticação, validação de acesso e continuidade do relacionamento.",
  registerSponsorCode: {
    label: "Código do patrocinador",
    placeholder: "Ex.: AP-XXXXXXXX (obrigatório)",
    requiredError: "Informe o código do patrocinador para se cadastrar.",
  },
  modes: {
    login: {
      title: "Entre com seus dados.",
      description: "Use o e-mail cadastrado para continuar sua jornada dentro da AXE PRIME.",
      submitLabel: "Entrar",
    },
    register: {
      title: "Crie seu acesso.",
      description:
        "Informe seus dados para iniciar sua entrada com a camada mais aderente ao seu momento.",
      submitLabel: "Criar acesso",
    },
    reset: {
      title: "Recupere seu acesso.",
      description: "Informe o e-mail cadastrado para receber as instruções de redefinição.",
      submitLabel: "Enviar instruções",
      secondaryLabel: "Voltar ao login",
    },
    "new-password": {
      title: "Defina sua nova senha.",
      description: "Informe o e-mail, o código de verificação e uma nova senha para concluir.",
      submitLabel: "Redefinir senha",
    },
  },
};

export const portalScreenCopy: PortalScreenCopy = {
  welcomeCopy:
    "Aqui você acompanha sua camada de entrada, mantém seus dados organizados e segue os próximos passos com clareza.",
  profileLabels: {
    plan: "Camada de entrada",
    status: "Status do acesso",
    email: "E-mail principal",
  },
  nextSteps: [
    "Use seu link de indicação e ganhe 10% sobre quem indicar direto.",
    "Acompanhe sua rede em Minha Equipe e a produtividade da equipe.",
    "Confirme seus dados em Perfil e revise a camada de entrada.",
    "Siga para os próximos movimentos com clareza.",
  ],
  compactCards: [
    {
      icon: "shield-check",
      title: "Entrada confirmada",
      body: "Seu acesso está ativo para seguir com segurança e continuidade.",
    },
    {
      icon: "layers-3",
      title: "Camada em curso",
      body: "Seu plano atual define o ponto de partida da sua jornada.",
    },
    {
      icon: "bell",
      title: "Próximas orientações",
      body: "As próximas comunicações aparecem aqui com objetividade e discrição.",
    },
  ],
  network: {
    title: "Minha Equipe",
    body: "Leitura visual da sua estrutura por camadas, com foco em atividade e expansão da rede.",
  },
};

export function getPortalWelcomeTitle(firstName: string) {
  return `Sua área está pronta, ${firstName}.`;
}
