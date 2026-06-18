import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).single();
      return data;
    },
  });

  const [nome, setNome] = useState("");
  useEffect(() => { if (profile) setNome(profile.nome ?? ""); }, [profile]);

  async function save() {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ nome }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <DashboardShell title="Perfil">
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
        <h2 className="font-display text-xl font-bold">Sua conta</h2>
        <div className="space-y-2"><Label>Email</Label><Input value={profile?.email ?? ""} disabled /></div>
        <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="space-y-2"><Label>Plano</Label><Input value={profile?.plano ?? "free"} disabled /></div>
        <Button onClick={save} className="bg-gradient-primary text-primary-foreground shadow-glow">Salvar</Button>
      </div>
    </DashboardShell>
  );
}
