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

const GOAL_LABELS: Record<string, string> = {
  ebook: "Ebook",
  sales_page: "Página de Vendas",
  presell: "Presell de Afiliado",
  ebook_and_page: "Ebook + Página de Vendas",
};

const INTRO: Msg = {
  role: "assistant",
  content: "Olá! 👋 Sou o Assistente FunnelBook AI.\n\nO que você quer criar hoje?\n\n📚 Ebook\n🛒 Página de Vendas\n🔗 Presell de Afiliado\n📚🛒 Ebook + Página de Vendas\n\nBasta me dizer ou clicar em um dos botões abaixo.",
};

function AssistantPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
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
  const briefingGoal: string | null = briefing?.goal ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  useEffect(() => { textareaRef.current?.focus(); }, [busy]);

  async function send(text?: string, hintGoal?: string) {
    const msg = (text ?? input).trim();
    if ((!msg && !hintGoal) || busy) return;
    if (!text) setInput("");
    setBusy(true);

    const userMsg: Msg = { role: "user", content: msg || `Quero criar: ${GOAL_LABELS[hintGoal ?? ""] ?? hintGoal}` };
    const optimistic: Msg[] = msg ? [...messages, userMsg] : [...messages, userMsg];
    qc.setQueryData(["assistant-conversation"], { messages: optimistic, briefing });

    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { messages: optimistic, goal: hintGoal ?? null },
      });
      if (error) {
        let errMsg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); if (b?.error) errMsg = b.error; }
        } catch { /* noop */ }
        throw new Error(errMsg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);

      // Se o briefing chegou, guarda o goal
      if ((data as any)?.goal) setSelectedGoal((data as any).goal);

      await qc.invalidateQueries({ queryKey: ["assistant-conversation"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao conversar com o assistente");
      qc.setQueryData(["assistant-conversation"], { messages, briefing });
    } finally {
      setBusy(false);
    }
  }

  async function resetConversation(goal?: string) {
    await supabase.from("assistant_conversations").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    setSelectedGoal(goal ?? null);
    qc.setQueryData(["assistant-conversation"], { messages: [INTRO], briefing: null });
    if (goal) {
      setTimeout(() => send("", goal), 100);
    }
  }

  const generateMut = useMutation({
    mutationFn: async (opts: { goal: string; testMode?: boolean }) => {
      const { goal, testMode = false } = opts;

      if (goal === "ebook" || goal === "ebook_and_page") {
        const { data, error } = await supabase.functions.invoke("generate-ebook", {
          body: { ...briefing, test_mode: testMode },
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
        return { type: "ebook", id: (data as any).ebookId as string };
      }

      if (goal === "sales_page") {
        const { data, error } = await supabase.functions.invoke("generate-sales-page-from-prompt", {
          body: { ...briefing, test_mode: testMode },
        });
        if (error) throw new Error(error.message);
        if ((data as any)?.error) throw new Error((data as any).error);
        return { type: "sales_page", id: (data as any).salesPageId as string };
      }

      if (goal === "presell") {
        const { data, error } = await supabase.functions.invoke("generate-presell", {
          body: { ...briefing, test_mode: testMode },
        });
        if (error) throw new Error(error.message);
        if ((data as any)?.error) throw new Error((data as any).error);
        return { type: "presell", id: (data as any).presellId as string, slug: (data as any).slug };
      }

      throw new Error("Objetivo inválido");
    },
    onSuccess: (data: any) => {
      toast.success("Pronto! Abrindo...");
      if (data.type === "ebook") navigate({ to: "/ebooks/$id", params: { id: data.id } });
      else if (data.type === "sales_page") navigate({ to: "/sales-pages/$id/edit", params: { id: data.id } });
      else if (data.type === "presell") navigate({ to: "/presells/$id/edit", params: { id: data.id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao gerar"),
  });

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const activeGoal = briefingGoal ?? selectedGoal;

  return (
    <DashboardShell title="Assistente IA">
      <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-gradient-card p-4 shadow-elegant">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-semibold">FunnelBook AI — Assistente</div>
              <div className="text-xs text-muted-foreground">
                {activeGoal ? `Criando: ${GOAL_LABELS[activeGoal] ?? activeGoal}` : "Responda as perguntas para montar seu briefing"}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => resetConversation()}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </div>

        {/* Goal selector */}
        {!briefing && (
          <div className="rounded-2xl border border-border bg-gradient-card p-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Atalho — escolha o que quer criar:</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={activeGoal === "ebook" ? "default" : "outline"} onClick={() => resetConversation("ebook")}>📚 Ebook</Button>
              <Button size="sm" variant={activeGoal === "sales_page" ? "default" : "outline"} onClick={() => resetConversation("sales_page")}>🛒 Página de Vendas</Button>
              <Button size="sm" variant={activeGoal === "presell" ? "default" : "outline"} onClick={() => resetConversation("presell")}>🔗 Presell de Afiliado</Button>
              <Button size="sm" variant={activeGoal === "ebook_and_page" ? "default" : "outline"} onClick={() => resetConversation("ebook_and_page")}>📚🛒 Ebook + Página</Button>
            </div>
          </div>
        )}

        {/* Chat */}
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
                {m.role === "assistant" && m.content.trim().startsWith("{") && m.content.includes('"done"')
                  ? `✅ Briefing de ${GOAL_LABELS[activeGoal ?? ""] ?? "conteúdo"} pronto! Clique em "Gerar" abaixo.`
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

        {/* Briefing pronto */}
        {briefing && (
          <div className="rounded-2xl border border-primary/40 bg-gradient-card p-4 shadow-elegant">
            <div className="mb-2 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <span className="font-display font-semibold">Briefing pronto — {GOAL_LABELS[briefingGoal ?? ""] ?? briefingGoal ?? "conteúdo"}</span>
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {Object.entries(briefing).filter(([k]) => k !== "goal").map(([k, v]) => (
                <div key={k}><b className="text-foreground">{k}:</b> {String(v)}</div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={generateMut.isPending}
                onClick={() => generateMut.mutate({ goal: briefingGoal ?? "ebook" })}
                className="bg-gradient-primary text-primary-foreground shadow-glow"
              >
                {generateMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar {GOAL_LABELS[briefingGoal ?? "ebook"] ?? "Conteúdo"}
              </Button>
              <Button
                variant="outline"
                disabled={generateMut.isPending}
                onClick={() => generateMut.mutate({ goal: briefingGoal ?? "ebook", testMode: true })}
              >
                🧪 Testar sem gastar crédito
              </Button>
              <Button
                variant="ghost"
                disabled={generateMut.isPending}
                onClick={() => resetConversation()}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Editar briefing
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">O botão "Testar" gera conteúdo de demonstração sem IA real.</p>
          </div>
        )}

        {/* Input */}
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
          <Button onClick={() => send()} disabled={busy || !input.trim()} className="bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
