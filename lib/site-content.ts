export type IconKey =
  | "award"
  | "banknote"
  | "briefcase"
  | "building"
  | "car"
  | "chart"
  | "crown"
  | "gem"
  | "globe"
  | "home"
  | "layers"
  | "network"
  | "plane"
  | "shield"
  | "sparkles"
  | "wallet";

export type ContentCard = {
  title: string;
  body: string;
  icon: IconKey;
  eyebrow?: string;
  tag?: string;
};


export type RewardCard = ContentCard & {
  imageSrc: string;
  imageAlt: string;
};

export type MetricCard = {
  value: string;
  label: string;
  note: string;
  countTo?: number;
};

export type CareerStep = {
  role: string;
  summary: string;
};

export type PackageTier = {
  name: string;
  creditLabel: string;
  capital: string;
  summary: string;
  features: string[];
  returns?: {
    investment: number;
    cashback: number;
  };
  featured?: boolean;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type Testimonial = {
  name: string;
  role: string;
  tier: string;
  quote: string;
  initials: string;
  photo?: string;
};

export type NavItem = {
  label: string;
  href: string;
  kind: "section" | "route";
};

export const siteUrl = "https://www.axeprime.com.br";

export const navItems: NavItem[] = [
  { label: "Direção", href: "#manifesto", kind: "section" },
  { label: "Benefícios", href: "#beneficios", kind: "section" },
  { label: "Carreira", href: "#carreira", kind: "section" },
  { label: "FAQ", href: "#faq", kind: "section" },
  { label: "Simulador de investimentos", href: "/simulador", kind: "route" },
];

export const heroMetrics: MetricCard[] = [
  {
    value: "Desde 2016",
    label: "estrutura em movimento",
    note: "Origem de uma operação orientada por estratégia patrimonial.",
  },
  {
    value: "+340",
    label: "membros ativos",
    note: "Perfis que já operam dentro da estrutura AXE PRIME.",
    countTo: 340,
  },
  {
    value: "50% de volta",
    label: "cashback institucional",
    note: "Retorno tratado como alavanca de liquidez e planejamento.",
    countTo: 50,
  },
  {
    value: "Certificação",
    label: "excelência técnica",
    note: "Referência de critério para a camada mais alta da jornada.",
  },
];

export const strategicPillars: ContentCard[] = [
  {
    eyebrow: "Liquidez imediata",
    title: "Liquidez com direção.",
    body: "A estrutura combina capital, cashback e leitura patrimonial para destravar movimento sem diluir a visão de longo prazo.",
    icon: "wallet",
  },
  {
    eyebrow: "Aquisição planejada",
    title: "Aquisição sem improviso.",
    body: "Imóveis, veículos e ativos passam a seguir uma construção disciplinada, com previsibilidade e eficiência.",
    icon: "building",
  },
  {
    eyebrow: "Crescimento estruturado",
    title: "Conforto com permanência.",
    body: "A jornada une acesso, patrimônio e continuidade para que presente e futuro operem sob a mesma leitura.",
    icon: "chart",
  },
];

export const lifestyleBenefits: ContentCard[] = [
  {
    title: "Fluxo preservado",
    body: "A estrutura busca aliviar pressão mensal para que o capital siga trabalhando com mais consistência.",
    icon: "home",
  },
  {
    title: "Custo de vida zero",
    body: "Despesas recorrentes passam a ser lidas dentro de uma estratégia maior, e não como custo inevitável.",
    icon: "banknote",
  },
  {
    title: "Lifestyle premium",
    body: "Desfrute no agora. Receba até 50% de volta por um ano enquanto seu capital principal é multiplicado.",
    icon: "sparkles",
  },
];

export const careerSteps: CareerStep[] = [
  {
    role: "Afiliado Prime",
    summary: "Participação sobre os relacionamentos desenvolvidos diretamente.",
  },
  {
    role: "Advisor",
    summary: "Camada voltada a coordenar a primeira expansão da estrutura.",
  },
  {
    role: "Gestor",
    summary: "Evolução da operação com leitura mais ampla de continuidade.",
  },
  {
    role: "Gerente Sênior",
    summary: "Escala associada a consistência e lideranças em formação.",
  },
  {
    role: "Diretor Geral",
    summary: "Camada final vinculada a governança e excelência técnica.",
  },
];

export const ascensionRequirements: ContentCard[] = [
  {
    title: "Ativação",
    body: "Ser cliente ativo ou iniciar a formação dos primeiros parceiros qualificados para abrir a trilha de liderança.",
    icon: "briefcase",
  },
  {
    title: "Desenvolvimento",
    body: "As camadas intermediárias avançam pela capacidade de desenvolver novas lideranças com continuidade.",
    icon: "network",
  },
  {
    title: "Alta gestão",
    body: "A etapa final combina expansão, governança e excelência técnica em um único critério de maturidade.",
    icon: "shield",
  },
];

export const rewards: RewardCard[] = [
  {
    title: "Rolex ou Cartier",
    body: "Reconhecimento ligado a consistência, status e maturidade de liderança.",
    icon: "award",
    imageSrc: "/media/axe-reward-rolex-cartier.webp",
    imageAlt:
      "Composição fotográfica ultra realista com relógios de luxo sobre mármore escuro em iluminação editorial.",
  },
  {
    title: "Viagem para Dubai",
    body: "Imersão global para lideranças que sustentam a expansão com continuidade.",
    icon: "plane",
    imageSrc: "/media/axe-reward-dubai.webp",
    imageAlt:
      "Cena ultra realista de chegada de luxo em Dubai com skyline noturno e atmosfera premium.",
  },
  {
    title: "BMW X4, Porsche 911 e Ferrari 296 GTS",
    body: "Premiações materiais desenhadas para simbolizar performance e posicionamento.",
    icon: "car",
    imageSrc: "/media/axe-reward-supercars.webp",
    imageAlt:
      "Foto ultra realista com trio de carros esportivos premium em ambiente noturno sofisticado.",
  },
  {
    title: "iPhone 17 Pro Max",
    body: "Reconhecimento adicional associado a resultado e consistência.",
    icon: "gem",
    imageSrc: "/media/axe-reward-iphone.webp",
    imageAlt:
      "Close editorial ultra realista de smartphone premium com acabamento metálico em fundo escuro.",
  },
];

export const packageTiers: PackageTier[] = [
  {
    name: "Start",
    creditLabel: "Crédito de",
    capital: "R$ 100.000",
    summary: "Aporte R$ 520 / mês",
    returns: {
      investment: 520,
      cashback: 260,
    },
    features: [
      "Retorno mensal proporcional com cashback mensal de até 4,17% sobre o investimento",
      "Acesso ao plano de carreira para começar como Afiliado Prime com 10% de comissão",
      "Suporte especializado com consultoria financeira e acompanhamento mensal",
      "Networking exclusivo com acesso a eventos e comunidade de investidores",
    ],
  },
  {
    name: "Prime",
    creditLabel: "Crédito de",
    capital: "R$ 200.000",
    summary: "Aporte R$ 1.040 / mês",
    returns: {
      investment: 1040,
      cashback: 520,
    },
    features: [
      "Máxima alavancagem com cashback de até 50% no primeiro ano",
      "Cashback acelerado com até R$ 6.240 de volta no primeiro ano",
      "Prioridade em ativos exclusivos com acesso antecipado a imóveis e veículos premium",
      "Custo zero com dinheiro extra por 12 meses para zerar seus custos",
      "Gestor dedicado com atendimento VIP e acompanhamento exclusivo",
    ],
    featured: true,
  },
];

export const relationshipLayers: ContentCard[] = [
  {
    title: "Base patrimonial",
    body: "Ponto de entrada definido pela camada de capital escolhida, com acesso proporcional ao percurso.",
    icon: "wallet",
  },
  {
    title: "Expansão direta",
    body: "Participação vinculada aos relacionamentos construídos diretamente, com leitura clara de continuidade.",
    icon: "network",
  },
  {
    title: "Liderança sucessiva",
    body: "Evolução por camadas a partir do desenvolvimento consistente de rede, critério e governança.",
    icon: "crown",
  },
];

export const faqItems: FaqItem[] = [
  {
    question: "Para quem essa jornada foi desenhada?",
    answer:
      "Para perfis que desejam combinar construção patrimonial, alavancagem inteligente e uma rota organizada de crescimento financeiro.",
  },
  {
    question: "O plano de carreira é obrigatório?",
    answer:
      "Não. A carreira aparece como uma alavanca opcional para quem deseja expandir por relacionamento e liderança.",
  },
  {
    question: "Os ganhos e benefícios são garantidos?",
    answer:
      "Não. Elegibilidade, contratos, metas e performance precisam ser analisados individualmente.",
  },
  {
    question: "Qual a diferença entre Start e Prime?",
    answer:
      "A diferença principal está no capital-base, na profundidade da alavancagem e no nível de prioridade sobre benefícios e ativos.",
  },
];

export const proofHighlights = [
  "Fundadores com formação no Brasil e nos Estados Unidos.",
  "Arquitetura que combina liquidez, aquisição planejada e expansão relacional.",
  "Critério técnico e visão de longo prazo no centro da jornada.",
] as const;

export const testimonials: Testimonial[] = [
  {
    name: "Rafael Monteiro",
    role: "Gerente Sênior",
    tier: "Prime",
    quote:
      "A estrutura AXE PRIME mudou a forma como leio meu patrimônio. Em menos de 18 meses, já estava planejando a aquisição do meu segundo imóvel com liquidez real.",
    initials: "RM",
    photo: "/team/rafael.png",
  },
  {
    name: "Camila Ferraz",
    role: "Advisor",
    tier: "Start",
    quote:
      "Entrei pela camada Start e já no primeiro trimestre entendi o diferencial. Organização, critério e um network que de fato abre portas.",
    initials: "CF",
    photo: "/team/camila.png",
  },
  {
    name: "Bruno Alves",
    role: "Afiliado Prime",
    tier: "Prime",
    quote:
      "A clareza da jornada é o que mais me surpreendeu. Cada etapa faz sentido, e os resultados são tangíveis dentro de um prazo real.",
    initials: "BA",
    photo: "/team/bruno.png",
  },
];

export const disclaimer =
  "Retornos, benefícios e elegibilidade dependem de perfil, metas, análise contratual e condições de operação.";
