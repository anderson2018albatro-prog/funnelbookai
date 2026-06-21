import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw, Send, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant")({
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const INTRO: Msg = {
  role: "assistant",
  content:
    "Oi! 👋 Sou o Assistente FunnelBook AI. Vou te ajudar a montar o briefing do seu ebook em poucos minutos. Para começar: qual é o **tema** do ebook que você quer criar?",
};

function AssistantPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const convQ = useQuery({
    queryKey: ["assistant-conversation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_conversations")
        .select("messages, briefing")
        .maybeSingle();
      if (error) throw error;
      return data ?? { messages: [INTRO], briefing: null };
    },
  });

  const messages: Msg[] = (convQ.data?.messages as Msg[] | undefined) ?? [INTRO];
  const briefing = (convQ.data?.briefing ?? null) as any;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  useEffect(() => { textareaRef.current?.focus(); }, [busy]);

  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setBusy(true);

    const optimistic: Msg[] = [...messages, { role: "user", content: text }];
    qc.setQueryData(["assistant-conversation"], { messages: optimistic, briefing });

    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { messages: optimistic },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; }
        } catch { /* noop */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      await qc.invalidateQueries({ queryKey: ["assistant-conversation"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao conversar com o assistente");
      qc.setQueryData(["assistant-conversation"], { messages, briefing });
    } finally {
      setBusy(false);
    }
  }

  async function resetConversation() {
    if (!confirm("Limpar a conversa e começar um novo briefing?")) return;
    await supabase.from("assistant_conversations").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    qc.setQueryData(["assistant-conversation"], { messages: [INTRO], briefing: null });
  }

  const generateMut = useMutation({
    mutationFn: async (opts: { withPage: boolean; onlyPage?: boolean }) => {
      if (opts.onlyPage) {
        // Find latest ebook for user to attach a page (fallback: generate ebook too)
        const { data: ebooks } = await supabase.from("ebooks")
          .select("id, status").eq("status", "completed")
          .order("created_at", { ascending: false }).limit(1);
        if (!ebooks?.length) throw new Error("Gere um ebook primeiro para criar a página.");
        const { error } = await supabase.functions.invoke("generate-sales-page", { body: { ebookId: ebooks[0].id } });
        if (error) throw new Error(error.message);
        return { ebookId: ebooks[0].id };
      }
      const { data, error } = await supabase.functions.invoke("generate-ebook", { body: briefing });
      if (error) {
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; }
        } catch { /* noop */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return { ...(data as { ebookId: string }), withPage: opts.withPage };
    },
    onSuccess: (data: any) => {
      toast.success("Pronto! Acompanhe na próxima tela.");
      navigate({ to: "/ebooks/$id", params: { id: data.ebookId } });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao gerar"),
  });

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <DashboardShell title="Assistente IA">
      <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-gradient-card p-4 shadow-elegant">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-semibold">Vamos montar seu ebook</div>
              <div className="text-xs text-muted-foreground">Responda 8 perguntas e a IA monta o briefing.</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={resetConversation}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm " +
                  (m.role === "user"
                    ? "bg-gradient-primary text-primary-foreground"
                    : "bg-surface text-foreground")
                }
              >
                {/* esconde JSON final cru se aparecer */}
                {m.role === "assistant" && m.content.trim().startsWith("{") && m.content.includes('"done"')
                  ? "✅ Briefing pronto! Clique em \"Gerar Ebook com essas informações\" abaixo."
                  : m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-surface px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="inline h-3 w-3 animate-spin" /> digitando…
              </div>
            </div>
          )}
        </div>

        {briefing && (
          <div className="rounded-2xl border border-primary/40 bg-gradient-card p-4 shadow-elegant">
            <div className="mb-2 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <span className="font-display font-semibold">Briefing pronto</span>
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <div><b className="text-foreground">Tema:</b> {briefing.tema}</div>
              <div><b className="text-foreground">Público:</b> {briefing.publico_alvo}</div>
              <div><b className="text-foreground">Promessa:</b> {briefing.promessa}</div>
              <div><b className="text-foreground">Problema:</b> {briefing.problema}</div>
              <div><b className="text-foreground">Idioma:</b> {briefing.idioma}</div>
              <div><b className="text-foreground">Tom:</b> {briefing.tom_voz}</div>
              <div><b className="text-foreground">Capítulos:</b> {briefing.capitulos}</div>
              <div><b className="text-foreground">Uso:</b> {briefing.uso}</div>
            </div>
            <Button
              className="mt-3 w-full bg-gradient-primary text-primary-foreground shadow-glow"
              disabled={creating || generateMut.isPending}
              onClick={() => { setCreating(true); generateMut.mutate(); }}
            >
              {generateMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Gerar Ebook com essas informações
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Escreva sua resposta…"
            rows={2}
            className="resize-none border-0 focus-visible:ring-0"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()} className="bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
