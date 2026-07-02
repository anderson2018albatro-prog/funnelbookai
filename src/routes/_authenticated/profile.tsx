import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen, Link2, Loader2, Megaphone, Save, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [prof, credits, stats] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).single(),
        supabase.from("user_credits").select("credits").maybeSingle(),
        Promise.all([
          supabase.from("ebooks").select("id", { count: "exact", head: true }),
          supabase.from("sales_pages").select("id", { count: "exact", head: true }),
          supabase.from("presells").select("id", { count: "exact", head: true }),
        ]),
      ]);
      return {
        ...prof.data,
        credits: credits.data?.credits ?? 0,
        ebooks: stats[0].count ?? 0,
        pages: stats[1].count ?? 0,
        presells: stats[2].count ?? 0,
      };
    },
  });

  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setNome(profile.nome ?? "");
  }, [profile]);

  async function save() {
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ nome }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["profile"] });
    setSaving(false);
  }

  if (isLoading) {
    return (
      <DashboardShell title="Perfil">
        <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Perfil">
      <div className="mx-auto max-w-xl space-y-5">

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Créditos", value: profile?.credits ?? 0, icon: Sparkles, color: "text-amber-500" },
            { label: "Ebooks", value: profile?.ebooks ?? 0, icon: BookOpen, color: "text-primary" },
            { label: "Páginas", value: profile?.pages ?? 0, icon: Megaphone, color: "text-blue-500" },
            { label: "Presells", value: profile?.presells ?? 0, icon: Link2, color: "text-green-500" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-gradient-card p-4 text-center shadow-elegant">
              <s.icon className={`mx-auto h-5 w-5 ${s.color}`} />
              <div className="mt-2 font-display text-2xl font-bold">{s.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Dados da conta */}
        <div className="space-y-4 rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
          <h2 className="font-display text-xl font-bold">Sua conta</h2>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled className="bg-surface" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nome">Nome de exibição</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
          </div>
          <div className="space-y-1">
            <Label>Plano atual</Label>
            <Input value={profile?.plano ?? "free"} disabled className="bg-surface capitalize" />
          </div>
          <Button onClick={save} disabled={saving} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar alterações
          </Button>
        </div>

        {/* Créditos */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h3 className="font-display font-semibold">Créditos</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Você tem <strong className="text-foreground">{profile?.credits ?? 0} crédito(s)</strong>. Cada ebook gerado consome 1 crédito.
            Páginas de venda e presells são gratuitas.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Em breve: recarga de créditos e planos premium.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
