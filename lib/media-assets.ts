export type MediaAsset = {
  kind: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
  eyebrow: string;
  title: string;
  description: string;
  priority?: boolean;
};

export const landingMedia = {
  heroLoop: {
    kind: "video",
    src: "/media/axe-hero-loop.mp4",
    poster: "/media/axe-hero-loop-poster.webp",
    alt: "Loop cinematográfico com atmosfera patrimonial e oceano noturno.",
    eyebrow: "Horizonte",
    title: "Construindo o futuro hoje.",
    description:
      "A elite da estratégia patrimonial, segurança e visão de longo prazo.",
  },
  benefitsImage: {
    kind: "image",
    src: "/media/axe-benefits-residence.webp",
    alt: "Residência contemporânea de alto padrão com vista para o oceano ao entardecer.",
    eyebrow: "Patrimônio aplicado",
    title: "Patrimônio que ganha forma com critério.",
    description:
      "Liquidez, aquisição e conforto reunidos sob a mesma disciplina de capital.",
    priority: true,
  },
  careerImage: {
    kind: "image",
    src: "/media/axe-career-strategy-room.webp",
    alt: "Sala de estratégia de luxo com vista noturna para a cidade e atmosfera cinematográfica.",
    eyebrow: "Ascensão",
    title: "Expansão pede método.",
    description:
      "Relacionamento, critério técnico e liderança evoluindo dentro da mesma estrutura.",
  },
  plansImage: {
    kind: "image",
    src: "/media/axe-plans-structured-capital.webp",
    alt: "Objeto escultórico premium representando capital estruturado em ambiente azul oceano.",
    eyebrow: "Capital estruturado",
    title: "Start ou Prime. A direção é a mesma.",
    description:
      "Duas camadas de entrada, com intensidade e alcance distintos.",
  },
} satisfies Record<string, MediaAsset>;

type MediaWithAvailability = MediaAsset & {
  available: boolean;
  posterAvailable: boolean;
};

export function getLandingMedia(): Record<
  keyof typeof landingMedia,
  MediaWithAvailability
> {
  return Object.fromEntries(
    Object.entries(landingMedia).map(([key, asset]) => [
      key,
      {
        ...asset,
        available: true,
        posterAvailable: Boolean("poster" in asset && asset.poster),
      },
    ]),
  ) as Record<keyof typeof landingMedia, MediaWithAvailability>;
}
