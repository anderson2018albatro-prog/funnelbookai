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
import { PRESELL_TYPE_LABELS } from "@/lib/presell-blocks";

export const Route = createFileRoute("/_authenticated/presells/new")({
  component: NewPresell,
});

function NewPresell() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    source_url: "", affiliate_url: "", presell_type: "review",
    niche: "", target_audience: "", tone: "persuasivo", language: "pt-BR", extra_prompt: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.affiliate_url) { toast.error("Informe o link de afiliado"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-presell", { body: form });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const id = (data as any).presellId as string;
      toast.success("Presell criada! Gerando conteúdo...");
      navigate({ to: "/presells/$id/edit", params: { id } });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <DashboardShell title="Nova Presell">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <strong>Presell ética:</strong> nenhum cookie de afiliado é definido sem clique. O usuário precisa
          clicar no botão CTA para ser redirecionado ao site oficial. Sem cookie stuffing, sem redirecionamento
          invisível.
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div>
            <Label>Link da página/produto a analisar</Label>
            <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)}
              placeholder="https://siteoficial.com/produto" />
            <p className="mt-1 text-xs text-muted-foreground">Opcional. A IA tenta extrair título, descrição e principais informações.</p>
          </div>
          <div>
            <Label>Link de afiliado *</Label>
            <Input value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)}
              placeholder="https://go.hotmart.com/SEU_LINK" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Tipo de presell</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.presell_type} onChange={(e) => set("presell_type", e.target.value)}>
                {Object.entries(PRESELL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><Label>Nicho</Label><Input value={form.niche} onChange={(e) => set("niche", e.target.value)} /></div>
            <div><Label>Público-alvo</Label><Input value={form.target_audience} onChange={(e) => set("target_audience", e.target.value)} /></div>
            <div>
              <Label>Tom de voz</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.tone} onChange={(e) => set("tone", e.target.value)}>
                <option value="persuasivo">Persuasivo</option>
                <option value="profissional">Profissional</option>
                <option value="amigavel">Amigável</option>
                <option value="jornalistico">Jornalístico</option>
              </select>
            </div>
            <div>
              <Label>Idioma</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.language} onChange={(e) => set("language", e.target.value)}>
                <option value="pt-BR">Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Comando extra para IA</Label>
            <Textarea rows={3} value={form.extra_prompt} onChange={(e) => set("extra_prompt", e.target.value)}
              placeholder="Ex.: foque nos benefícios para iniciantes; mencione frete grátis; use linguagem informal" />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar presell
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
