import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/new-ebook")({
  component: NewEbook,
});

function NewEbook() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tema: "",
    publico_alvo: "",
    promessa: "",
    problema: "",
    idioma: "Português",
    tom_voz: "Profissional e acessível",
    tamanho: "medio" as "curto" | "medio" | "completo" | "custom",
    paginas: 25,
    uso: "venda",
  });

  const presetPages: Record<string, number> = { curto: 12, medio: 25, completo: 45 };
  const effectivePages = form.tamanho === "custom" ? form.paginas : presetPages[form.tamanho];

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.tema || !form.publico_alvo) throw new Error("Preencha tema e público-alvo.");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Sessão expirada. Faça login novamente.");
      const payload = {
        ...form,
        paginas: effectivePages,
      };
      const { data, error } = await supabase.functions.invoke("generate-ebook", { body: payload });
      if (error) {
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; }
        } catch { /* noop */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const id = (data as any)?.ebookId;
      if (!id) throw new Error("Resposta inválida da função.");
      return id as string;
    },
    onSuccess: (id) => {
      toast.success("Geração iniciada! Acompanhe abaixo.");
      navigate({ to: "/ebooks/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar ebook"),
  });

  return (
    <DashboardShell title="Gerar Ebook">
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/40 bg-gradient-card p-4 shadow-elegant">
          <div className="flex items-center gap-2 text-sm">
            <Bot className="h-4 w-4 text-primary" />
            <span>Prefere conversar? Use o Assistente IA para montar o briefing.</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => navigate({ to: "/assistant" })}>
            Abrir assistente
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Briefing manual</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="tema">Tema / Nicho *</Label>
              <Input id="tema" value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} placeholder="Ex.: Emagrecimento saudável após os 40" />
            </div>
            <div>
              <Label htmlFor="publico">Público-alvo *</Label>
              <Textarea id="publico" value={form.publico_alvo} onChange={(e) => setForm({ ...form, publico_alvo: e.target.value })} placeholder="Ex.: Mulheres 40-55 anos que querem perder peso sem dietas restritivas" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="promessa">Promessa principal</Label>
                <Textarea id="promessa" value={form.promessa} onChange={(e) => setForm({ ...form, promessa: e.target.value })} rows={2} placeholder="Ex.: Perder 5 kg em 60 dias sem dieta" />
              </div>
              <div>
                <Label htmlFor="problema">Problema que resolve</Label>
                <Textarea id="problema" value={form.problema} onChange={(e) => setForm({ ...form, problema: e.target.value })} rows={2} placeholder="Ex.: Cansaço, metabolismo lento" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="idioma">Idioma</Label>
                <Input id="idioma" value={form.idioma} onChange={(e) => setForm({ ...form, idioma: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="tom">Tom de voz</Label>
                <Input id="tom" value={form.tom_voz} onChange={(e) => setForm({ ...form, tom_voz: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tamanho do ebook</Label>
                <Select value={form.tamanho} onValueChange={(v) => setForm({ ...form, tamanho: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curto">Curto (10–15 páginas)</SelectItem>
                    <SelectItem value="medio">Médio (20–30 páginas)</SelectItem>
                    <SelectItem value="completo">Completo (40–50 páginas)</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                {form.tamanho === "custom" && (
                  <div className="mt-2">
                    <Label htmlFor="pgs" className="text-xs">Páginas aproximadas (10 a 50)</Label>
                    <Input id="pgs" type="number" min={10} max={50} value={form.paginas}
                      onChange={(e) => setForm({ ...form, paginas: Math.min(50, Math.max(10, Number(e.target.value) || 25)) })} />
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">Será gerado com ~{effectivePages} páginas.</p>
              </div>
              <div>
                <Label>Uso</Label>
                <Select value={form.uso} onValueChange={(v) => setForm({ ...form, uso: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Vender este ebook</SelectItem>
                    <SelectItem value="gratuito">Usar como material gratuito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={mut.isPending} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
          {mut.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando…</>) : (<><Sparkles className="mr-2 h-4 w-4" /> Gerar Ebook</>)}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Consome 1 crédito. A geração leva ~30-60s e é processada em background.</p>
      </form>
    </DashboardShell>
  );
}
