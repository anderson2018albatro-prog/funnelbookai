import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/new-project")({
  component: NewProject,
});

function NewProject() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome_projeto: "", nicho: "", publico_alvo: "", promessa: "",
    idioma: "Português", quantidade_capitulos: 5,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { data: project, error } = await supabase.from("projects").insert({
        ...form, user_id: u.user.id,
      }).select().single();
      if (error) throw error;

      toast.info("Gerando ebook com IA... pode levar até 1 minuto.");
      const { data: gen, error: gErr } = await supabase.functions.invoke("generate-ebook", {
        body: { projectId: project.id },
      });
      if (gErr) throw gErr;
      if ((gen as any)?.error) throw new Error((gen as any).error);
      toast.success("Ebook gerado!");
      navigate({ to: "/projects/$id", params: { id: project.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell title="Novo Projeto">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
          <h2 className="font-display text-2xl font-bold">Crie seu projeto</h2>
          <p className="mt-1 text-sm text-muted-foreground">Preencha as informações e a IA gera seu ebook completo.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Nome do Projeto</Label>
              <Input required value={form.nome_projeto} onChange={(e) => setForm({ ...form, nome_projeto: e.target.value })} placeholder="Ex: Guia da Renda Passiva" />
            </div>
            <div className="space-y-2">
              <Label>Nicho</Label>
              <Input required value={form.nicho} onChange={(e) => setForm({ ...form, nicho: e.target.value })} placeholder="Ex: Finanças pessoais" />
            </div>
            <div className="space-y-2">
              <Label>Público-Alvo</Label>
              <Textarea required value={form.publico_alvo} onChange={(e) => setForm({ ...form, publico_alvo: e.target.value })} placeholder="Ex: Jovens profissionais entre 25-40 anos..." />
            </div>
            <div className="space-y-2">
              <Label>Promessa Principal</Label>
              <Textarea required value={form.promessa} onChange={(e) => setForm({ ...form, promessa: e.target.value })} placeholder="Ex: Como construir uma reserva de R$50k em 12 meses" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={form.idioma} onValueChange={(v) => setForm({ ...form, idioma: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Português">Português</SelectItem>
                    <SelectItem value="Inglês">Inglês</SelectItem>
                    <SelectItem value="Espanhol">Espanhol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capítulos</Label>
                <Input type="number" min={3} max={15} value={form.quantidade_capitulos} onChange={(e) => setForm({ ...form, quantidade_capitulos: Number(e.target.value) })} />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="mr-2 h-4 w-4" />
              {loading ? "Gerando ebook..." : "GERAR EBOOK"}
            </Button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
