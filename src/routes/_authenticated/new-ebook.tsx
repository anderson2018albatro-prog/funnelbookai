import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/new-ebook")({
  component: NewEbook,
});

function NewEbook() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    tema: "",
    publico_alvo: "",
    idioma: "Português",
    tom_voz: "Profissional e acessível",
    capitulos: 6,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tema || !form.publico_alvo) {
      toast.error("Preencha tema e público-alvo.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ebook", { body: form });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Ebook gerado com sucesso!");
      navigate({ to: "/ebooks/$id", params: { id: (data as any).ebook.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao gerar ebook");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title="Gerar Ebook">
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Descreva seu ebook</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="tema">Tema / Nicho *</Label>
              <Input id="tema" value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} placeholder="Ex.: Emagrecimento saudável após os 40" />
            </div>
            <div>
              <Label htmlFor="publico">Público-alvo *</Label>
              <Textarea id="publico" value={form.publico_alvo} onChange={(e) => setForm({ ...form, publico_alvo: e.target.value })} placeholder="Ex.: Mulheres 40-55 anos que querem perder peso sem dietas restritivas" rows={3} />
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
            <div>
              <Label htmlFor="caps">Quantidade de capítulos</Label>
              <Input id="caps" type="number" min={3} max={15} value={form.capitulos} onChange={(e) => setForm({ ...form, capitulos: Number(e.target.value) || 6 })} />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
          {busy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando ebook…</>) : (<><Sparkles className="mr-2 h-4 w-4" /> Gerar Ebook</>)}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Consome 1 crédito.</p>
      </form>
    </DashboardShell>
  );
}
