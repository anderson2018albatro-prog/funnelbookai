import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/presells/new")({
  component: NewPresell,
});

type TypeGroup = {
  label: string;
  icon: string;
  desc: string;
  types: { value: string; label: string; desc: string; badge?: string }[];
};

const TYPE_GROUPS: TypeGroup[] = [
  {
    label: "Gate Pages",
    icon: "⚡",
    desc: "Alta conversão — zero escape rate. Qualquer clique redireciona ao link.",
    types: [
      { value: "age_gate", label: "Verificação de Idade", desc: "Confirmar 18+ antes do redirect", badge: "Zero Escape" },
      { value: "gender_gate", label: "Seleção de Gênero", desc: "Masculino / Feminino → redirect", badge: "Zero Escape" },
      { value: "country_gate", label: "Seleção de País", desc: "Grid de bandeiras → redirect", badge: "Zero Escape" },
      { value: "captcha_gate", label: "CAPTCHA de Segurança", desc: "\"Não sou robô\" → redirect", badge: "Zero Escape" },
    ],
  },
  {
    label: "Urgência & Oferta",
    icon: "🔥",
    desc: "Páginas com timer e cupom para aumentar conversão.",
    types: [
      { value: "countdown", label: "Timer de Urgência", desc: "Contagem regressiva + benefícios" },
      { value: "coupon", label: "Cupom de Desconto", desc: "Exibe código + timer de expiração" },
    ],
  },
  {
    label: "Conteúdo Completo",
    icon: "📄",
    desc: "Páginas longas geradas com IA — excelentes para SEO e Google Ads.",
    types: [
      { value: "review", label: "Review Premium", desc: "Análise completa com pros/cons e FAQ" },
      { value: "story", label: "Narrativa de Transformação", desc: "História pessoal de transformação" },
      { value: "advertorial", label: "Advertorial", desc: "Matéria editorial jornalística" },
      { value: "native_ad", label: "Anúncio Nativo", desc: "Artigo patrocinado estilo jornal" },
      { value: "listicle", label: "Listicle (Top Razões)", desc: "\"Top 5 razões por que...\"" },
    ],
  },
  {
    label: "Interativo",
    icon: "🎯",
    desc: "Envolve o leitor e qualifica antes do redirect.",
    types: [
      { value: "quiz", label: "Quiz Presell", desc: "Perguntas que levam ao produto como resposta" },
      { value: "comparativo", label: "Comparativo", desc: "Tabela comparativa produto vs alternativas" },
      { value: "vsl", label: "VSL (vídeo)", desc: "Página de vídeo de vendas" },
    ],
  },
  {
    label: "Simples",
    icon: "🔗",
    desc: "Páginas diretas e minimalistas.",
    types: [
      { value: "bridge", label: "Bridge Page", desc: "Direta: benefícios + aviso + CTA" },
      { value: "cookie_notice", label: "Aviso de Redirect", desc: "Ultra simples: aviso + botão" },
    ],
  },
];

function NewPresell() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    source_url: "", affiliate_url: "", presell_type: "review",
    niche: "", target_audience: "", tone: "persuasivo", language: "auto",
    extra_prompt: "", manual_info: "",
    whatsapp_phone: "", whatsapp_message: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.affiliate_url) { toast.error("Informe o link de afiliado"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-presell", {
        body: {
          ...form,
          whatsapp_phone: form.whatsapp_phone.replace(/\D/g, ""),
        },
      });
      if (error) {
        let msg = error.message;
        try { const ctx: any = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* noop */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const id = (data as any).presellId as string;
      toast.success("Presell criada! Gerando conteúdo...");
      navigate({ to: "/presells/$id/edit", params: { id } });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  const isGate = ["age_gate", "gender_gate", "country_gate", "captcha_gate"].includes(form.presell_type);
  const selectedGroup = TYPE_GROUPS.find((g) => g.types.some((t) => t.value === form.presell_type));
  const selectedType = TYPE_GROUPS.flatMap((g) => g.types).find((t) => t.value === form.presell_type);

  return (
    <DashboardShell title="Nova Presell">
      <div className="mx-auto max-w-3xl space-y-4">

        {/* Ethics notice */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <strong>Presell ética:</strong> nenhum cookie de afiliado é definido sem clique real do usuário. Sem cookie stuffing, sem redirect invisível.
        </div>

        {/* Type selector */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display font-semibold text-base">Escolha o tipo de presell</h2>
          {TYPE_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>{group.icon}</span> {group.label}
                <span className="font-normal normal-case text-muted-foreground/70">— {group.desc}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.types.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set("presell_type", t.value)}
                    className={`relative rounded-xl border p-3 text-left text-sm transition-all ${
                      form.presell_type === t.value
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    {t.badge && (
                      <span className="absolute right-2 top-2 rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold text-yellow-600">
                        {t.badge}
                      </span>
                    )}
                    <div className="font-semibold leading-tight">{t.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground leading-tight">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Gate type info */}
        {isGate && (
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm flex items-start gap-2">
            <Zap className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <strong>Gate Page — Zero Escape Rate:</strong> página minimalista onde qualquer clique redireciona ao seu link de afiliado.
              A IA gera apenas a headline e CTA. Ideal para Google Ads com anúncios de alta CTR.
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div>
            <Label>Link de afiliado <span className="text-destructive">*</span></Label>
            <Input value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)}
              placeholder="https://go.hotmart.com/SEU_LINK" />
            <p className="mt-1 text-xs text-muted-foreground">Todos os botões da presell apontarão para este link.</p>
          </div>

          {!isGate && (
            <div>
              <Label>Link da página/produto a analisar</Label>
              <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)}
                placeholder="https://siteoficial.com/produto" />
              <p className="mt-1 text-xs text-muted-foreground">Opcional. A IA extrai título, descrição e benefícios automaticamente.</p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Nicho / Produto</Label><Input value={form.niche} onChange={(e) => set("niche", e.target.value)} placeholder="Ex: emagrecimento, marketing digital..." /></div>
            {!isGate && <div><Label>Público-alvo</Label><Input value={form.target_audience} onChange={(e) => set("target_audience", e.target.value)} placeholder="Ex: mulheres 35-55 anos" /></div>}
            <div>
              <Label>Tom de voz</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.tone} onChange={(e) => set("tone", e.target.value)}>
                <option value="persuasivo">Persuasivo</option>
                <option value="profissional">Profissional</option>
                <option value="amigavel">Amigável</option>
                <option value="jornalistico">Jornalístico</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <Label>Idioma</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.language} onChange={(e) => set("language", e.target.value)}>
                <option value="auto">🌐 Auto (detectar da página)</option>
                <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                <option value="pt-PT">🇵🇹 Português (Portugal)</option>
                <option value="en">🇺🇸 Inglês</option>
                <option value="es">🇪🇸 Espanhol</option>
                <option value="fr">🇫🇷 Francês</option>
                <option value="it">🇮🇹 Italiano</option>
                <option value="de">🇩🇪 Alemão</option>
                <option value="ja">🇯🇵 Japonês</option>
                <option value="zh">🇨🇳 Mandarim</option>
                <option value="ru">🇷🇺 Russo</option>
                <option value="ar">🇸🇦 Árabe</option>
                <option value="hi">🇮🇳 Hindi</option>
                <option value="nl">🇳🇱 Holandês</option>
                <option value="pl">🇵🇱 Polonês</option>
                <option value="tr">🇹🇷 Turco</option>
              </select>
            </div>
          </div>

          {!isGate && (
            <>
              <div>
                <Label>Comando extra para IA</Label>
                <Textarea rows={2} value={form.extra_prompt} onChange={(e) => set("extra_prompt", e.target.value)}
                  placeholder="Ex.: foque nos benefícios para iniciantes; mencione frete grátis; use linguagem informal" />
              </div>
              <div>
                <Label>Informações manuais do produto (opcional)</Label>
                <Textarea rows={2} value={form.manual_info} onChange={(e) => set("manual_info", e.target.value)}
                  placeholder="Cole nome, benefícios, preço, garantia, depoimentos... Usado quando a página oficial bloqueia leitura." />
              </div>
            </>
          )}

          {/* WhatsApp button optional */}
          <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base">💬</span>
              <span className="text-sm font-semibold">Botão WhatsApp flutuante <span className="text-muted-foreground font-normal">(opcional)</span></span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label className="text-xs">Número (com DDI, só dígitos)</Label>
                <Input value={form.whatsapp_phone} onChange={(e) => set("whatsapp_phone", e.target.value)}
                  placeholder="5511999999999" />
              </div>
              <div>
                <Label className="text-xs">Mensagem pré-preenchida</Label>
                <Input value={form.whatsapp_message} onChange={(e) => set("whatsapp_message", e.target.value)}
                  placeholder="Olá! Tenho interesse neste produto." />
              </div>
            </div>
          </div>

          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isGate ? "Criar Gate Page" : "Gerar presell com IA"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {isGate
              ? "Gate pages são geradas em segundos (conteúdo mínimo)."
              : "Páginas completas levam 20-60s para gerar (processamento em background)."}
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
