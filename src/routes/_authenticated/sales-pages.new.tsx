import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales-pages/new")({
  component: NewSalesPage,
});

const PAGE_TYPES = [
  { v: "vendas", label: "Página de vendas direta" },
  { v: "infoproduto", label: "Página para infoproduto" },
  { v: "fisico", label: "Página para produto físico" },
  { v: "afiliado", label: "Página para afiliado" },
  { v: "captura", label: "Página de captura" },
];

function NewSalesPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    prompt: "", product_name: "", niche: "", target_audience: "",
    promessa: "", offer: "", button_url: "",
    language: "pt-BR", tone: "persuasivo", page_type: "vendas",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.prompt && !form.product_name) {
      toast.error("Informe um comando ou o nome do produto");
      return;
    }
    setBusy(true);
    try {
      const fullPrompt = [form.prompt, form.promessa ? `Promessa principal: ${form.promessa}` : ""]
        .filter(Boolean).join("\n");
      const { data, error } = await supabase.functions.invoke("generate-sales-page-from-prompt", {
        body: { ...form, prompt: fullPrompt },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const id = (data as any).salesPageId as string;
      toast.success("Página criada! Gerando conteúdo...");
      navigate({ to: "/sales-pages/$id/edit", params: { id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <DashboardShell title="Nova Página com IA">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-border bg-gradient-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Crie uma página de vendas só com um comando</h2>
          </div>
          <p className="text-sm text-muted-foreground">A IA vai escrever, estruturar e salvar tudo. Você edita depois.</p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div>
            <Label>Comando para a IA *</Label>
            <Textarea rows={3} value={form.prompt} onChange={(e) => set("prompt", e.target.value)}
              placeholder="Ex.: crie uma página de vendas para um curso de inglês fluente em 90 dias com foco em adultos iniciantes" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Nome do produto</Label><Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} /></div>
            <div><Label>Nicho</Label><Input value={form.niche} onChange={(e) => set("niche", e.target.value)} /></div>
            <div><Label>Público-alvo</Label><Input value={form.target_audience} onChange={(e) => set("target_audience", e.target.value)} /></div>
            <div><Label>Preço / oferta</Label><Input value={form.offer} onChange={(e) => set("offer", e.target.value)} placeholder="R$ 197 à vista" /></div>
          </div>
          <div>
            <Label>Promessa principal</Label>
            <Textarea rows={2} value={form.promessa} onChange={(e) => set("promessa", e.target.value)} />
          </div>
          <div>
            <Label>Link do botão de compra</Label>
            <Input value={form.button_url} onChange={(e) => set("button_url", e.target.value)} placeholder="https://pay.exemplo.com/..." />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Idioma</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.language} onChange={(e) => set("language", e.target.value)}>
                <option value="pt-BR">Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
            </div>
            <div>
              <Label>Tom de voz</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.tone} onChange={(e) => set("tone", e.target.value)}>
                <option value="persuasivo">Persuasivo</option>
                <option value="profissional">Profissional</option>
                <option value="amigavel">Amigável</option>
                <option value="agressivo">Agressivo</option>
              </select>
            </div>
            <div>
              <Label>Tipo de página</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.page_type} onChange={(e) => set("page_type", e.target.value)}>
                {PAGE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar página
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
