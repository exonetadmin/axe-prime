# AXE PRIME - Arquitetura do Projeto

## Visão Geral

O AXE PRIME foi reestruturado seguindo os princípios do framework **AIOX** e as melhores práticas de arquitetura de software.

---

## Princípios Arquiteturais

### 1. Feature-Based Organization
```
/src/features/[feature]/
  ├── components/     # UI específica da feature
  ├── services/       # Business logic
  ├── repositories/   # Data access
  ├── hooks/          # Custom hooks
  ├── types/          # TypeScript types
  ├── [feature].contract.ts  # Public API
  └── index.ts        # Barrel export
```

### 2. Contract Pattern
Cada feature expõe sua API pública através de um arquivo `.contract.ts`:
- Tipos de dados
- Interfaces de serviços
- Eventos
- Erros customizados

**Regra:** Outras features NUNCA importam de arquivos internos, apenas do `index.ts`.

### 3. Repository Pattern
- Todo acesso a dados isolado em repositories
- Facilita testes (mocking)
- Permite trocar implementação (SQLite → PostgreSQL)

### 4. Service Pattern
- Business logic encapsulada em serviços
- Sem dependência de framework (testável)
- Event-driven via Event Bus

### 5. Event Bus
- Comunicação desacoplada entre features
- Pattern Publish-Subscribe
- Type-safe events

---

## Estrutura de Pastas

```
axe-prime/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Auth pages
│   ├── portal/            # Portal pages
│   ├── simulador/         # Simulator pages
│   └── ...
├── src/
│   ├── features/          # Feature modules
│   │   ├── auth/         # Authentication feature
│   │   ├── simulator/    # Investment simulator
│   │   └── portal/       # Member portal
│   └── shared/           # Shared code
│       ├── components/   # Atomic design system
│       ├── hooks/        # Generic hooks
│       ├── utils/        # Utilities
│       └── events/       # Event Bus
├── tokens/               # Design tokens (DTCG)
├── docs/                 # Documentation
│   ├── stories/         # User stories
│   └── architecture/    # Architecture docs
├── test/                # Test utilities
│   ├── builders/        # Test fixtures
│   └── e2e/            # E2E tests
└── .github/
    └── workflows/       # CI/CD
```

---

## Features

### Auth Feature
**Responsabilidade:** Autenticação e gerenciamento de usuários

**Contrato Público:**
```typescript
export interface AuthContract {
  login(credentials: LoginCredentials): Promise<AuthResult>;
  register(data: RegisterData): Promise<AuthResult>;
  getCurrentUser(): Promise<User | null>;
  logout(): Promise<void>;
  // ...
}
```

**Eventos:**
- `auth:login` - Usuário logou
- `auth:logout` - Usuário deslogou
- `auth:registered` - Novo usuário registrado
- `auth:password-reset` - Senha redefinida

### Simulator Feature
**Responsabilidade:** Cálculos e projeções de investimento

**Contrato Público:**
```typescript
export interface SimulatorContract {
  calculate(plan: Plan, rate: number, amount: number): Simulation;
  comparePlans(amount: number): PlanComparison;
}
```

### Portal Feature
**Responsabilidade:** Dashboard do membro

---

## Design System

### Tokens
Formato W3C Design Tokens Community Group (DTCG):
- `tokens/colors.yaml` - Paleta de cores
- `tokens/typography.yaml` - Fontes e tamanhos
- `tokens/spacing.yaml` - Espaçamentos
- `tokens/effects.yaml` - Sombras e efeitos

### Componentes Atômicos
- **Button** - Variants: primary, secondary, ghost
- **Input** - Com label, error state, helper text
- **Card** - Glassmorphism com variants
- **Badge** - Variants semânticas

---

## Testing Strategy

### Pirâmide de Testes
```
        /\
       /E2E\           10% - Critical user flows
      /------\
     /Integration\     20% - Features working together
    /------------\
   /  Unit Tests  \    70% - Business logic, components
  /----------------\
```

### Cobertura
- Business logic: 90%+
- Components: 60%+
- Overall: 70%+

### Test Builders
```typescript
const user = new UserBuilder()
  .withEmail('test@example.com')
  .withPlan('prime')
  .build();
```

---

## CI/CD

### Quality Gates
1. **Lint & Type Check** - ESLint + TypeScript
2. **Unit Tests** - Vitest com coverage
3. **E2E Tests** - Playwright
4. **Build Verification** - Next.js build

### Branch Protection
- Pull requests obrigatórias
- Todos os checks devem passar
- Code review mínimo: 1 aprovação

---

## Convenções

### Nomenclatura
| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Components | PascalCase | `Button.tsx` |
| Hooks | useCamelCase | `useAuth.ts` |
| Services | camelCase + Service | `auth.service.ts` |
| Repositories | camelCase + Repository | `user.repository.ts` |
| Contracts | camelCase + .contract | `auth.contract.ts` |
| Tests | .test.ts ou .spec.ts | `auth.service.test.ts` |

### Imports
```typescript
// ✅ Bom - Import do barrel
import { LoginForm, authService } from '@/features/auth';

// ❌ Ruim - Import de implementação interna
import { LoginForm } from '@/features/auth/components/LoginForm';
```

---

## Segurança

### Autenticação
- JWT com httpOnly cookies
- bcryptjs para hashing (12 rounds)
- Validação de senha forte
- Rate limiting (implementar)

### Autorização
- Server Components para páginas protegidas
- Middleware não usado (Next.js 16+ usa Proxy)
- RLS policies quando migrar para PostgreSQL

---

## Roadmap

### Fase 1: Foundation ✅
- [x] Feature-based architecture
- [x] Auth refactor (Contract+Service+Repository)
- [x] Design tokens
- [x] Atomic components
- [x] Unit tests

### Fase 2: Quality 🚧
- [ ] E2E tests completos
- [ ] WCAG AA compliance
- [ ] Performance budget
- [ ] Storybook (opcional)

### Fase 3: Features
- [ ] Dashboard do investidor
- [ ] Analytics & tracking
- [ ] Exportação de relatórios
- [ ] API de evolução patrimonial

### Fase 4: Scale
- [ ] PostgreSQL migration
- [ ] Redis caching
- [ ] CDN setup
- [ ] Monitoring (Sentry)

---

## Referências

- [AIOX Framework](.aiox-core/)
- [Next.js React Tech Preset](.aiox-core/data/tech-presets/nextjs-react.md)
- [Design Tokens](tokens/)
- [Stories](docs/stories/)
