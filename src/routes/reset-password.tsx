import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha — FunnelBook AI" }] }),
  component: ResetPwd,
});

function ResetPwd() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <h1 className="font-display text-2xl font-bold">Definir nova senha</h1>
        <div className="space-y-2">
          <Label htmlFor="p">Nova senha</Label>
          <Input id="p" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">Salvar</Button>
      </form>
    </div>
  );
}
