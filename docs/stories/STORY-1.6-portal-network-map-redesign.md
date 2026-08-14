# Story 1.6: Redesign do Mapa de Rede do Portal

## Status
**Status:** ✅ Ready for Review  
**Assignee:** @dev + @ux-design-expert  
**Created:** 2026-03-15  
**Completed:** 2026-03-15

---

## Story
**Como** usuário autenticado,  
**Quero** ver minha rede em um mapa mais claro, hierárquico e alinhado à identidade do portal,  
**Para** entender a estrutura, a atividade e a expansão da minha base sem parecer um organograma genérico.

---

## Acceptance Criteria

- [x] O mapa de rede mantém a estrutura de dados atual
- [x] Os nós deixam de parecer apenas círculos soltos e ganham hierarquia visual mais clara
- [x] O estado ativo/inativo fica mais legível no próprio nó
- [x] O card do mapa ganha legenda e resumo da estrutura
- [x] O layout continua responsivo sem quebrar em telas menores
- [x] A copy da área deixa de falar em clique/expansão quando o mapa renderizado é estático
- [x] `npm run lint` passa
- [x] `npm run typecheck` passa
- [x] `npm run build` passa

---

## Dev Agent Record

### Tasks Checklist
- [x] Criar story do redesign do mapa de rede
- [x] Revisar a estrutura atual do renderer server-side
- [x] Redesenhar os nós da árvore como cards de sinal
- [x] Adicionar legenda e resumo estrutural acima do mapa
- [x] Revisar copy da seção para remover instruções incorretas
- [x] Ajustar responsividade do mapa e dos conectores
- [x] Rodar lint, typecheck e build
- [x] Atualizar checklist e file list

### Debug Log
```text
2026-03-15: Story criada para o redesign do mapa de rede do portal.
2026-03-15: A leitura do mapa foi reorientada de círculos genéricos para cards com camada, estado e ramificação.
2026-03-15: O header do bloco ganhou legenda e resumo da estrutura para reduzir texto instrucional espalhado.
2026-03-15: A copy da área foi ajustada para refletir a renderização real do mapa, sem mencionar clique/expansão no bloco server-side.
2026-03-15: O CSS do mapa foi redesenhado para melhorar ritmo, conectores, responsividade e presença visual dentro da identidade já existente.
2026-03-15: `npm test` global continua com falhas legadas fora desta entrega.
```

### Completion Notes
- O mapa agora comunica melhor origem, camada, atividade e expansão sem perder o tom dark-first do portal.
- A estrutura de dados foi preservada; a mudança ficou concentrada em apresentação e copy.
- O bloco ganhou um resumo rápido da rede para facilitar leitura antes da árvore.
- Os conectores e os nós ficaram menos “diagrama técnico cru” e mais parte do sistema visual do portal.
- `lint`, `typecheck` e `build` passaram.
- O `npm test` global segue falhando por suites legadas fora desta entrega.

---

## File List

### New Files
- `docs/stories/STORY-1.6-portal-network-map-redesign.md`

### Modified Files
- `app/portal/rede/page.tsx`
- `app/portal/rede/portal-rede-map-server.tsx`
- `app/portal/rede/portal-rede-tree.tsx`
- `app/globals.css`
- `lib/access-copy.ts`

---

## Change Log
| Date | Change | Author |
|------|--------|--------|
| 2026-03-15 | Story criada | @dev |
| 2026-03-15 | Redesign visual do mapa de rede com cards, legenda e resumo estrutural | @dev |
