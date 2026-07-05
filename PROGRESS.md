# PROGRESS — FunnelBook AI

## Sessão 3 (2026-07-05) — 3 grandes atualizações + deploy completo

**Tudo deployado**: front na Vercel (main) + todas as 6 edge functions no Supabase.
URL: https://funnelbookai.vercel.app

### Infra
- `_shared/ai.ts`: Claude Fable 5 (`ANTHROPIC_API_KEY`) como provedor prioritário,
  com fallback server-side p/ Opus 4.8 e depois Lovable → Gemini → OpenAI.
  Para ativar: configurar a secret `ANTHROPIC_API_KEY` no Supabase.

### Feature 1 — Ebook profissional
- Geração em 2 fases: esqueleto (título, capa, sumário, plano de capítulos com
  seções e descrição de imagem) + capítulo por capítulo em chamadas separadas,
  com retry automático (3x) e progresso parcial salvo no Supabase
- 7–12 capítulos, arco problema → agitação → método → aplicação prática
- Cada capítulo: storytelling de abertura, seções com subtítulos (`### `),
  exemplo prático brasileiro e box "Ação Prática"
- Prompt exige PT-BR natural/conversacional e proíbe clichês de IA
- `src/lib/ebook-art.ts`: capa profissional + banners decorativos por capítulo
  gerados por código (SVG → PNG, 8 paletas por hash do título)
- PDF: capa com gradiente/tipografia, sumário com links clicáveis, hierarquia
  tipográfica, box Ação Prática, rodapé com autor + numeração
- Editor: barra de progresso por capítulo, campo Ação Prática, preview da capa
- Formulário: campo autor + capítulos 7/8/10/12

### Feature 2 — Página de vendas com IA por comando livre
- Novo fluxo "Criar com IA": textarea grande + chips de sugestão clicáveis
- IA decide a estrutura: `vsl | carta | lancamento | low_ticket | high_ticket | assinatura`
- Copy BR direct response: headline big idea, lead de dor, mecanismo único
  nomeado, 8+ bullets de fascínio, stack com ancoragem, bônus com valores,
  garantia incondicional, FAQ de objeções, urgência ética, múltiplos CTAs
- Novos blocos: `video_vsl`, `dor`, `mecanismo`, `stack`, `urgencia`
- 3 temas visuais: clean branco, dark premium, high-convert (vermelho/amarelo)
- Regeneração por seção: `action: "regenerate_section"` na edge function +
  botões no editor (RefreshCw = regenerar; Sparkles + RefreshCw = com instrução)
- `supabase/functions/_shared/sales-blocks.ts` espelha `src/lib/sales-blocks.ts`

### Feature 3 — Presell premium
- Elementos de conversão em todos os formatos: barra de urgência, contador de
  "pessoas vendo agora", depoimentos, comentários estilo rede social (nomes BR,
  likes, tempo), selos, CTA fixo mobile
- Advertorial/native: byline de autor fictício genérico + data
- Quiz interativo (pergunta por vez → resultado + CTA); VSL com delay de botão
- Pixels FB/Google (instalação padrão, IDs sanitizados)
- Preview de exemplo de cada formato na criação (`samplePresell`)
- Guardrails mantidos + rodapé: "conteúdo ilustrativo" e "resultados não garantidos"

---

## Estado: COMPLETO e DEPLOYADO

- Vercel (front): auto-deploy do main ✅
- Edge functions (todas deployadas 2026-07-05): generate-ebook,
  generate-sales-page-from-prompt, generate-presell, generate-sales-page,
  assistant-chat, improve-copy ✅

## Teste manual recomendado

1. Ebook: criar com 7 capítulos → acompanhar barra de progresso → baixar PDF
   (capa, sumário clicável, boxes de Ação Prática)
2. Página de vendas: "Criar com IA" com comando livre → verificar estrutura
   escolhida → trocar tema → regenerar uma seção
3. Presell: criar review com pixel de teste → conferir urgência/contador/
   comentários → quiz interativo → publicar e abrir /pre/slug
4. Mock sem créditos: `test_mode: true` ou botões verdes em /debug

## Decisões

- Imagens do ebook: 100% programáticas (SVG) — sem APIs pagas nem LoremFlickr
- Depoimentos/comentários: sempre com aviso de conteúdo ilustrativo no rodapé
- Sem cloaking, sem redirect automático, sem cookie stuffing
- Pixels: apenas instalação padrão de PageView
