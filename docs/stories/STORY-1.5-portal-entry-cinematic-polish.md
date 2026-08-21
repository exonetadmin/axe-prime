# Story 1.5: Polimento Cinematográfico da Entrada do Portal

## Status
**Status:** ⚠️ Ready for Review  
**Assignee:** @dev  
**Created:** 2026-03-14
**Completed:** 2026-03-14

---

## Story
**Como** usuário autenticado,  
**Quero** uma entrada do portal mais cinematográfica, anatômica e responsiva ao meu movimento,  
**Para** que a experiência pareça premium, memorável e digna de sustentar a comunicação da AXE PRIME.

---

## Acceptance Criteria

- [x] O rosto 3D fica mais legível como busto sintético, com melhor leitura de olhos, boca, mandíbula e orelhas
- [x] A cena ganha partículas/orbitais ao redor do rosto sem voltar ao estilo terminal técnico
- [x] O rosto e o olhar respondem ao mouse no desktop e mantêm movimento idle quando não há interação
- [x] A abertura fica mais lenta e cinematográfica, com duração percebida maior que a atual
- [x] A copy da abertura fica mais alinhada à identidade da AXE PRIME
- [x] O fallback `reduced` continua funcional em mobile/save-data
- [x] `npm run lint` passa
- [x] `npm run typecheck` passa
- [x] `npm run build` passa

---

## Implementation Record

### Tasks Checklist
- [x] Criar story do polimento cinematográfico
- [x] Refinar anatomia procedural do rosto 3D
- [x] Adicionar orbitais/moléculas ao redor do rosto
- [x] Implementar idle gaze e resposta ao mouse
- [x] Alongar a timeline da entrada e refinar o ritmo
- [x] Revisar copy da sequência para o tom AXE PRIME
- [x] Comprimir e endurecer o layout textual da abertura para viewports mais baixos
- [x] Validar visualmente no navegador após login
- [x] Rodar lint, typecheck e build

### Debug Log
```text
2026-03-14: Story criada para o polimento cinematográfico da entrada do portal.
2026-03-14: Rosto procedural foi aprofundado com nova silhueta, geometrias faciais e shell mais translúcido.
2026-03-14: Orbitais/moléculas foram adicionados ao redor da cabeça para reforçar presença cinematográfica.
2026-03-14: O componente 3D passou a ler o mouse internamente e manter idle gaze quando não há interação.
2026-03-14: A timeline full foi alongada para 6.2s e a reduced para 3.6s.
2026-03-14: Copy da abertura foi alinhada ao tom reservado e patrimonial da AXE PRIME.
2026-03-14: Validação em browser local confirmou a abertura após login e o handoff correto para o portal.
2026-03-14: Cena foi otimizada com menos partículas, sem bloom/postprocessing pesado e com shell menos dominante.
2026-03-14: A leitura principal do rosto passou a usar uma malha facial em grade, reduzindo dependência do point cloud aleatório.
2026-03-14: A copy da abertura foi compactada e a folha de estilo recebeu regras por altura de viewport para evitar texto cortado em telas mais baixas.
2026-03-14: O dock inferior foi ancorado na base da viewport para manter cards de etapa, headline e copy sempre visíveis na mesma composição.
2026-03-14: O dock foi comprimido novamente com headline mais curta, copy menor e cards mais baixos para sair do limite inferior em desktops mais baixos.
2026-03-14: O texto abaixo dos cards foi removido da abertura, deixando apenas as etapas e a barra de progresso para eliminar qualquer corte residual.
2026-03-14: `npm test` global continua com uma falha legada em `src/features/auth/__tests__/auth.service.test.ts`.
```

### Completion Notes
- A abertura ficou mais lenta, com maior leitura de presença e menos aparência de loader técnico.
- A cabeça 3D ganhou volumes mais claros de olhos, mandíbula, boca e orelhas, além de orbitais externos.
- O movimento agora alterna entre seguimento do mouse e idle gaze.
- O custo da cena foi reduzido com menos partículas, menos ambient nodes, dpr menor e remoção de bloom pesado.
- A estrutura visual do rosto agora depende mais de malha facial procedural e menos de nuvem de pontos aleatória.
- O encaixe do texto foi endurecido com layout mais compacto, copy mais curta e breakpoints por altura de viewport.
- O bloco inferior da abertura agora fica travado na base da viewport, com o texto aparecendo logo abaixo dos cards de etapa.
- O dock final ficou mais curto e com menos ruído visual, reduzindo o risco de texto fora da visualização.
- A abertura agora não exibe mais headline/copy abaixo dos cards de etapa.
- `lint`, `typecheck`, `build` e o teste focado `__tests__/portal-entry.test.ts` passaram.
- O `npm test` global segue falhando por suites legadas fora desta entrega.

---

## File List

### New Files
- `docs/stories/STORY-1.5-portal-entry-cinematic-polish.md`

### Modified Files
- `components/portal-entry-face.tsx`
- `components/portal-entry-sequence.tsx`
- `components/portal-entry-sequence.module.css`
- `lib/portal-entry.ts`
- `__tests__/portal-entry.test.ts`

---

## Change Log
| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | Story criada | @dev |
| 2026-03-14 | Cena 3D do portal refinada com orbitais, idle gaze e pacing mais cinematográfico | @dev |
