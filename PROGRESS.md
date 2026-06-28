# PROGRESS — FunnelBook AI (branch: terminar-saas-claude)

## Sessão 2 (2026-06-27) — Presell completo

### O que foi entregue

#### Detecção automática de idioma
- `generate-presell/index.ts`: função `detectLangFromHtml()` extrai `<html lang="...">` da página do produtor
- 14 idiomas mapeados: pt-BR, pt-PT, en, es, fr, de, it, ja, zh, ru, ar, hi, nl, pl, tr
- Select de idioma: primeira opção agora é "Auto (detectar da página)"
- Default mudou de `"pt-BR"` para `"auto"` — fallback para pt-BR quando não detecta

#### Botão WhatsApp flutuante
- `generate-presell/index.ts`: aceita `whatsapp_phone` + `whatsapp_message` no body
- `presell-blocks.ts`: tipo `whatsapp_button` adicionado ao `PresellBlockKey`
- `renderPresellHtml`: renderiza botão SVG fixo bottom-right antes do `</body>`
- `presells.new.tsx`: campos opcionais Phone + Mensagem na criação
- `presells.$id.edit.tsx`: case `whatsapp_button` no BlockEditor (phone, mensagem, cor)
- Backfill automático para presells antigas no editor (sem whatsapp_button no DB)

#### Página de Política de Privacidade
- Nova rota `src/routes/pre.$slug.privacidade.tsx` → `/pre/:slug/privacidade`
- Server function busca title + disclosure do Supabase
- Seções: afiliado, dados coletados, cookies, conteúdo, contato
- Rodapé de todas as presells agora tem link "Política de Privacidade"
- Nota clara sobre depoimentos placeholder e sem cookie stuffing

---

## Estado atual dos 3 fluxos

### 1. Presell (generate-presell)
- ✅ Fluxo: affiliate_url + source_url opcional → IA gera → editor visual
- ✅ 6 tipos conteúdo: review, advertorial, vsl, comparativo, quiz, bridge
- ✅ Gate pages: age_gate, gender_gate, country_gate, captcha_gate
- ✅ Urgência: countdown, coupon
- ✅ Cores da marca extraídas do site do produtor
- ✅ Detecção automática de idioma (detectLangFromHtml)
- ✅ Botão WhatsApp flutuante (opcional, configurável no editor)
- ✅ Página de Política de Privacidade auto-gerada por slug
- ⬜ Deploy: aguardando confirmação do usuário (constraint: sem deploy sem ok explícito)

### 2. Ebook (generate-ebook)
- ✅ Geração com Gemini/OpenAI/Lovable
- ✅ Bug Gemini key corrigido e deployado (sessão 1)
- ✅ PDF com imagens LoremFlickr por capítulo
- ✅ Editor visual pós-geração

### 3. Página de Vendas (generate-sales-page)
- ✅ Geração a partir do ebook
- ✅ Geração a partir de prompt livre (generate-sales-page-from-prompt)
- ✅ Editor de blocos com preview ao vivo
- ✅ Polling corrigido: editor atualiza quando IA termina (sessão 1)
- ✅ Bug Gemini key + repairJson corrigidos (sessão 1, não deployado)
- ⬜ Deploy: aguardando confirmação do usuário

---

## Pendências

1. **[DEPLOY] generate-presell** — tem todas as features novas, precisa de deploy
2. **[DEPLOY] generate-sales-page** — Gemini key + repairJson corrigidos, precisa de deploy
3. **[OPCIONAL] Presell: testimoniais gerados pela IA**  
   - Nos tipos review/story/advertorial, a IA pode gerar testemunhos mas devem ser marcados como `[EXEMPLO]`
   - Atualmente o prompt não instrui sobre isso explicitamente (mas a página de vendas já tem aviso de placeholder)

---

## Decisões tomadas

- Imagens PDF ebook: LoremFlickr (gratuito, CORS). Sem API paga conforme instrução.
- Depoimentos: marcados como placeholder. Nunca apresentados como reais.
- Sem cloaking, sem redirect automático, sem cookie stuffing.
- WhatsApp: link `wa.me` — redirect real após clique do usuário.
- Deploy: nunca na main. Só na branch `terminar-saas-claude`.

---

## O que precisa de você

- Para **deploy das edge functions** (generate-presell, generate-sales-page): confirme "pode fazer deploy" e eu executo
- Opcional: API de imagens paga (Stability AI, Dall-E) para ebook com imagens temáticas reais
