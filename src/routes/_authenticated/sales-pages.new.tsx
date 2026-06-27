import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Megaphone, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales-pages/new")({
  component: NewSalesPage,
});

const PAGE_TYPES = [
  { v: "vendas", label: "🎯 Página de vendas direta", desc: "Produto digital ou físico com foco em converter" },
  { v: "infoproduto", label: "📚 Infoproduto / Curso", desc: "Curso online, ebook, mentoria" },
  { v: "afiliado", label: "🔗 Afiliado", desc: "Você revende o produto de outro produtor" },
  { v: "fisico", label: "📦 Produto físico", desc: "Produto tangível com entrega" },
  { v: "captura", label: "📧 Captura de leads", desc: "Coleta e-mails com oferta gratuita" },
  { v: "webinar", label: "🎙️ Webinar / Evento", desc: "Inscrição para evento ao vivo ou gravado" },
];

function NewSalesPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    prompt: "",
    product_name: "",
    niche: "",
    target_audience: "",
    promessa: "",
    dor_principal: "",
    resultado_esperado: "",
    offer: "",
    price: "",
    garantia: "",
    button_url: "",
    language: "pt-BR",
    tone: "persuasivo",
    page_type: "vendas",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.product_name && !form.prompt) {
      toast.error("Informe o nome do produto ou descreva o que quer criar");
      return;
    }
    setBusy(true);
    try {
      const fullPrompt = [
        form.prompt,
        form.dor_principal ? `Dor principal do cliente: ${form.dor_principal}` : "",
        form.resultado_esperado ? `Resultado esperado: ${form.resultado_esperado}` : "",
        form.garantia ? `Garantia: ${form.garantia}` : "",
        form.price ? `Preço: ${form.price}` : "",
      ].filter(Boolean).join("\n");

      const { data, error } = await supabase.functions.invoke("generate-sales-page-from-prompt", {
        body: { ...form, prompt: fullPrompt },
      });
      if (error) {
        let msg = error.message;
        try { const ctx: any = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* noop */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const id = (data as any).salesPageId as string;
      toast.success("Página criada! Gerando conteúdo com IA...");
      navigate({ to: "/sales-pages/$id/edit", params: { id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <DashboardShell title="Nova Página de Vendas">
      <div className="mx-auto max-w-3xl space-y-5">

        {/* Hero banner */}
        <div className="rounded-2xl border border-primary/30 bg-gradient-card p-5 shadow-elegant flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Megaphone className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold">Gerador de Página de Vendas com IA</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Preencha o briefing do produto e a IA cria uma página completa: headline, benefícios, depoimentos, FAQ, oferta e CTA.
              Você edita cada bloco depois.
            </p>
          </div>
        </div>

        {/* Step 1: Type + Product */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display font-semibold">1. Produto e tipo de página</h2>

          <div>
            <Label>Tipo de página</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PAGE_TYPES.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => set("page_type", t.v)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left text-sm transition-all ${
                    form.page_type === t.v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <div>
                    <div className="font-semibold">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nome do produto <span className="text-destructive">*</span></Label>
              <Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)}
                placeholder="Ex.: Curso Inglês Fluente em 90 Dias" />
            </div>
            <div>
              <Label>Nicho / categoria</Label>
              <Input value={form.niche} onChange={(e) => set("niche", e.target.value)}
                placeholder="Ex.: idiomas, marketing digital, saúde..." />
            </div>
          </div>
        </div>

        {/* Step 2: Copy briefing */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display font-semibold">2. Briefing de copy</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Público-alvo</Label>
              <Input value={form.target_audience} onChange={(e) => set("target_audience", e.target.value)}
                placeholder="Ex.: adultos 30-50 anos que querem aprender inglês" />
            </div>
            <div>
              <Label>Promessa principal</Label>
              <Input value={form.promessa} onChange={(e) => set("promessa", e.target.value)}
                placeholder="Ex.: falar inglês fluente em 90 dias sem sotaque" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Dor / problema do cliente</Label>
              <Input value={form.dor_principal} onChange={(e) => set("dor_principal", e.target.value)}
                placeholder="Ex.: vergonha de falar inglês, travar nas palavras" />
            </div>
            <div>
              <Label>Resultado desejado</Label>
              <Input value={form.resultado_esperado} onChange={(e) => set("resultado_esperado", e.target.value)}
                placeholder="Ex.: conseguir promoção, viajar com confiança" />
            </div>
          </div>

          <div>
            <Label>Instruções extras para a IA</Label>
            <Textarea rows={2} value={form.prompt} onChange={(e) => set("prompt", e.target.value)}
              placeholder="Ex.: enfatize que não precisa ter base prévia; mencione que é 100% online; inclua urgência de vagas limitadas" />
          </div>
        </div>

        {/* Step 3: Offer */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display font-semibold">3. Oferta e preço</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Preço / oferta</Label>
              <Input value={form.offer} onChange={(e) => set("offer", e.target.value)}
                placeholder="Ex.: 12x R$19,70 ou R$197 à vista" />
            </div>
            <div>
              <Label>Garantia</Label>
              <Input value={form.garantia} onChange={(e) => set("garantia", e.target.value)}
                placeholder="Ex.: 30 dias de garantia incondicional" />
            </div>
          </div>

          <div>
            <Label>Link do botão de compra</Label>
            <Input value={form.button_url} onChange={(e) => set("button_url", e.target.value)}
              placeholder="https://pay.hotmart.com/... ou https://go.exemplo.com/..." />
          </div>
        </div>

        {/* Step 4: Style */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display font-semibold">4. Estilo e idioma</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Tom de voz</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.tone} onChange={(e) => set("tone", e.target.value)}>
                <option value="persuasivo">Persuasivo — convence com lógica e emoção</option>
                <option value="profissional">Profissional — formal e técnico</option>
                <option value="amigavel">Amigável — próximo e acessível</option>
                <option value="agressivo">Agressivo — direto ao ponto, sem rodeios</option>
                <option value="premium">Premium — exclusivo, sofisticado</option>
              </select>
            </div>
            <div>
              <Label>Idioma</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.language} onChange={(e) => set("language", e.target.value)}>
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
        </div>

        <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow" size="lg">
          {busy ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando página de vendas...</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" /> Gerar página de vendas completa</>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          A IA vai gerar: headline, benefícios, depoimentos, FAQ, oferta e CTAs. Leva ~30-60 segundos.
        </p>
      </div>
    </DashboardShell>
  );
}
