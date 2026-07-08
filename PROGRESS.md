# PROGRESS — FunnelBook AI

## Sessão 6 (2026-07-07) — Ebook visual profissional com ilustrações por IA

### O que foi implementado
1. **Ilustrações reais por capítulo (Gemini imagem)** — na edge function
   `generate-ebook`, cada capítulo dispara em PARALELO com o texto uma geração
   de imagem (`gemini-2.5-flash-image`, fallback
   `gemini-2.0-flash-preview-image-generation`, timeout 45s) a partir do
   `image_description` que a IA já planejava. A imagem sobe pro novo bucket
   público `ebook-assets` (`{user_id}/{ebook_id}/ch-N.png`) e a URL fica em
   `chapters[i].image_url`. **Falha de imagem nunca trava o ebook** — só pula
   aquela imagem (logs: "Gerando ilustração do capítulo 3...", "Erro ao gerar
   imagem do capítulo 3, pulando...", "ilustrações prontas: X/Y").
2. **Capa profissional com imagem** — a IA também gera uma imagem de capa
   (`cover_image_url`); o `coverSvg` ganhou layout com janela de imagem
   arredondada + título abaixo (tipografia grande, paleta por hash do título,
   já existente). No editor há botão "Imagem de capa" para **upload manual**
   (bucket `ebook-assets`), que substitui a gerada.
3. **Design do PDF** (client-side, jsPDF):
   - Contraste tipográfico: títulos Helvetica bold coloridos (paleta) +
     corpo em **Times serifada** 11.5/17 + legendas em itálico
   - **Cabeçalho** com título do livro + linha na cor da paleta (pág. 3+) e
     rodapé com autor + numeração (já existia, mantido)
   - **Sumário clicável com pontilhado** entre título e nº da página
   - **Ilustração no início de cada capítulo** (proporção preservada, máx.
     280pt, centralizada, legenda opcional = image_description) + banner
     decorativo SVG como fallback quando não há imagem
   - **Separador visual** (`dividerSvg`, que existia e não era usado) no fim
     de cada capítulo
   - Capa embute a imagem via data URL (evita canvas tainted por CORS)
4. **Robustez**: jsonrepair mantido; imagens não consomem tokens de LLM
   (API separada), limites de token inalterados (esqueleto 4000 / capítulo
   2200); tudo que falha em imagem é log + skip, nunca erro fatal.

### Banco (aplicado no remoto via Management API)
- Bucket `ebook-assets` público + policies RLS — migration
  `supabase/migrations/20260707230000_ebook_assets_bucket.sql`

### Arquivos alterados
- `supabase/functions/generate-ebook/index.ts` — geração/upload de ilustrações
- `src/lib/ebook-art.ts` — `coverSvg({imageHref})`, `fetchImageAsDataUrl`,
  `imageDimensions`
- `src/routes/_authenticated/ebooks.$id.tsx` — PDF redesign + upload de capa +
  preview das ilustrações no editor

### Deploy necessário
```
npx supabase functions deploy generate-ebook --project-ref nygbgczhydtzyfgbqwkr --use-api
# Front (SEM integração git — deploy manual):
npx vercel deploy --prod --yes
```

---

## Sessão 5 (2026-07-07) — Construtor de Página de Vendas via CHAT

O usuário conversa com a IA, descreve o que quer na página (textos, seções,
oferta, depoimentos), envia imagens direto no chat, e vê a página sendo
montada em tempo real num preview ao lado.

### Como funciona
1. **Rota `/sales-pages/builder`** (`src/routes/_authenticated/sales-pages.builder.tsx`):
   chat à esquerda + preview em iframe à direita (desktop); no mobile, abas
   Chat/Preview. Botão 📎 anexa imagem (máx 8MB) → upload no bucket público
   `sales-assets` (`{user_id}/chat-*.ext`) → URL vai junto da mensagem.
   `?page=<id>` retoma a conversa de uma página existente (action "load").
   Preview renderizado no cliente via `renderBlocksToHtml` a cada resposta.
2. **Edge Function `sales-chat-builder`** (nova): recebe a mensagem, carrega
   histórico (tabela `sales_chats`) + blocos atuais da página, monta prompt
   com o estado JSON e a conversa, e a IA devolve `{reply, patch}`. O patch
   é validado/mesclado nos blocos (`applyPatch`: só chaves conhecidas, URLs
   http(s) apenas, listas substituídas por inteiro), a página é re-renderizada
   e salva. Primeiro turno cria a `sales_pages` + `sales_chats`. Parse com
   `jsonrepair` (mesmo padrão do ebook). `test_mode: true` responde sem IA.
3. **IA decide onde a imagem entra** pelo contexto: foto do produto →
   `product.image_url`; print de depoimento → item em `depoimentos` com
   `image_url`; selo → `garantia.image_url`. Se ambíguo, ela pergunta.
4. **Estrutura profissional**: os 17 blocos existentes (hero, dor, mecanismo,
   produto, promessa, benefícios, stack com ancoragem, bônus, depoimentos,
   oferta, garantia, urgência, FAQ, CTA final repetido) + rodapé legal novo
   ("resultados podem variar", termos da plataforma de pagamento).
5. **Guardrails éticos**: prompt proíbe cloaking, popups enganosos e
   contadores/vagas falsas (urgência só real e informada pelo usuário);
   depoimentos SÓ com material fornecido — o servidor força
   `is_placeholder: true` (aviso visível na página) quando a IA cria
   depoimentos sem material do usuário na conversa.

### Banco (aplicado no remoto via Management API)
- Nova tabela `public.sales_chats` (uma conversa por página, RLS por dono)
  — migration `supabase/migrations/20260707210000_sales_chats.sql`

### Arquivos alterados/criados
- `supabase/functions/sales-chat-builder/index.ts` (novo)
- `supabase/migrations/20260707210000_sales_chats.sql` (novo)
- `src/routes/_authenticated/sales-pages.builder.tsx` (novo)
- `src/lib/sales-blocks.ts` + `supabase/functions/_shared/sales-blocks.ts`
  (espelhados): `image_url` em itens de depoimento e na garantia (selo),
  render das imagens, rodapé com informações legais
- `src/routes/_authenticated/sales-pages.new.tsx`: card-link para o construtor

### Deploy necessário
```
npx supabase functions deploy sales-chat-builder --project-ref nygbgczhydtzyfgbqwkr --use-api
# _shared/sales-blocks.ts mudou → redeployar também:
npx supabase functions deploy generate-sales-page-from-prompt --project-ref nygbgczhydtzyfgbqwkr --use-api
npx supabase functions deploy generate-sales-page --project-ref nygbgczhydtzyfgbqwkr --use-api
# Front (SEM integração git — deploy manual):
npx vercel deploy --prod --yes
```

### Não alterado (fora do escopo, conforme pedido)
- Autenticação, billing, gerador de ebook e fluxo antigo de sales page
  (formulário "Criar com IA" continua funcionando igual)

---

## Sessão 4 (2026-07-07) — Novo formato de presell: Bridge Story

Página ponte narrativa e ética — reduz bloqueio de anúncio via conteúdo real,
sem dark patterns (nada de clique enganoso, urgência falsa ou prova social fabricada).

### O que foi feito
- Novo tipo `bridge_story` (junto de review, advertorial, quiz, vsl, comparativo etc.)
- Estrutura: topbar de transparência → headline → story (hook + descoberta em
  1ª pessoa) → how_it_works (transição suave) → benefits (2-3 reais) → CTA honesto
- Excluídos de propósito: urgency_bar, viewers_counter, testimonials/comments
  fabricados, popup de cookie, countdown (forçado também no `buildBlocks`)
- Prompt do Gemini com guardrails obrigatórios: sem clickbait agressivo, sem
  escassez/prazos falsos, CTA que diz exatamente o que faz, disclosure de afiliado,
  proibido imitar página oficial do produtor
- Card no seletor (grupo "Conteúdo Completo") + preview `samplePresell` + tema
  visual próprio (editorial calmo, tons quentes) + mock do `test_mode` com story
- Validado localmente: `npx tsc --noEmit` limpo + 10 checagens de guardrail no
  HTML renderizado (script em scratchpad; exemplo em `bridge-story-exemplo.html`,
  arquivo local não versionado — pode apagar após validar)

### Arquivos alterados
- `supabase/functions/generate-presell/index.ts` — VALID_TYPES, defaultOrderFor,
  typeGuidance + regras específicas no prompt, buildBlocks (urgency/viewers off),
  mock com story/how_it_works
- `src/lib/presell-blocks.ts` — PresellType, label, defaultOrderFor, samplePresell,
  typeStyles (CSS do formato)
- `src/routes/_authenticated/presells.new.tsx` — card no TYPE_GROUPS

### Pendente
- Deploy da edge function `generate-presell` (aguardando validação visual do usuário)

---

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
