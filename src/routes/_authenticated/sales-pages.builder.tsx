import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Eye, ImagePlus, Loader2, MessageSquare, PencilRuler, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { renderBlocksToHtml, backfillBlocks, type SalesBlocks } from "@/lib/sales-blocks";

export const Route = createFileRoute("/_authenticated/sales-pages/builder")({
  component: SalesPageBuilder,
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === "string" ? search.page : undefined,
  }),
});

type ChatMsg = { role: "user" | "assistant"; content: string; image_url?: string };

const INTRO: ChatMsg = {
  role: "assistant",
  content:
    "Olá! 👋 Sou o construtor de páginas de vendas.\n\nMe diga o que você quer na sua página: produto, público, preço, seções (dor, depoimentos, bônus, garantia, FAQ...).\n\nVocê também pode enviar imagens 📎 — foto do produto, prints de depoimentos, selo de garantia — e eu coloco na seção certa.\n\nExemplo: \"Quero uma página para meu curso de confeitaria de R$97, com título forte, seção de depoimentos e botão de compra em destaque\".",
};

async function invokeBuilder(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("sales-chat-builder", { body });
  if (error) {
    let msg = error.message;
    try { const ctx: any = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* noop */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

function SalesPageBuilder() {
  const { page: pageParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [pageId, setPageId] = useState<string | null>(pageParam ?? null);
  const [slug, setSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([INTRO]);
  const [blocks, setBlocks] = useState<SalesBlocks | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!pageParam);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Retomar conversa de uma página existente (?page=<id>)
  useEffect(() => {
    if (!pageParam) return;
    (async () => {
      try {
        const data = await invokeBuilder({ action: "load", page_id: pageParam });
        setPageId(data.page_id);
        setSlug(data.slug);
        setBlocks(data.blocks);
        const hist = (data.messages ?? []) as ChatMsg[];
        setMessages(hist.length ? hist : [INTRO]);
      } catch (e: any) {
        toast.error(e.message);
      } finally { setLoading(false); }
    })();
  }, [pageParam]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  // Preview em tempo real: renderiza os blocos no cliente a cada atualização
  const previewHtml = useMemo(() => {
    if (!blocks) return "";
    return renderBlocksToHtml(backfillBlocks(blocks), "Sua página de vendas");
  }, [blocks]);

  function pickImage(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Envie um arquivo de imagem"); return; }
    if (f.size > 8 * 1024 * 1024) { toast.error("Imagem muito grande (máx. 8MB)"); return; }
    setPendingImage({ file: f, preview: URL.createObjectURL(f) });
  }

  async function uploadPendingImage(): Promise<string | null> {
    if (!pendingImage) return null;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sessão expirada"); return null; }
    const ext = pendingImage.file.name.split(".").pop() || "jpg";
    const path = `${u.user.id}/chat-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("sales-assets").upload(path, pendingImage.file, { upsert: true });
    if (upErr) { toast.error(upErr.message); return null; }
    const { data } = supabase.storage.from("sales-assets").getPublicUrl(path);
    return data.publicUrl;
  }

  async function send() {
    const text = input.trim();
    if ((!text && !pendingImage) || busy) return;
    setBusy(true);
    try {
      let imageUrl: string | null = null;
      if (pendingImage) {
        imageUrl = await uploadPendingImage();
        if (!imageUrl) { setBusy(false); return; }
      }
      const userMsg: ChatMsg = {
        role: "user",
        content: text || "(imagem enviada)",
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setPendingImage(null);

      const data = await invokeBuilder({
        page_id: pageId,
        message: { text, ...(imageUrl ? { image_url: imageUrl } : {}) },
      });
      if (!pageId && data.page_id) {
        setPageId(data.page_id);
        navigate({ search: { page: data.page_id }, replace: true });
      }
      setSlug(data.slug ?? slug);
      setBlocks(data.blocks);
      setMessages((m) => [...m, { role: "assistant", content: data.reply as string }]);
      setMobileTab("chat");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao conversar com o construtor");
      setMessages((m) => m[m.length - 1]?.role === "user" ? m.slice(0, -1) : m);
    } finally { setBusy(false); }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const chatPane = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa…
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm " +
                (m.role === "user" ? "bg-gradient-primary text-primary-foreground" : "bg-surface text-foreground")
              }
            >
              {m.image_url && (
                <img src={m.image_url} alt="imagem enviada" className="mb-2 max-h-40 rounded-lg" />
              )}
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-surface px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin" /> montando a página…
            </div>
          </div>
        )}
      </div>

      {pendingImage && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <img src={pendingImage.preview} alt="preview" className="h-12 w-12 rounded-lg object-cover" />
          <span className="flex-1 truncate text-xs text-muted-foreground">{pendingImage.file.name}</span>
          <Button variant="ghost" size="sm" onClick={() => setPendingImage(null)}><X className="h-4 w-4" /></Button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
        <Button variant="outline" size="icon" className="shrink-0" title="Enviar imagem"
          onClick={() => fileRef.current?.click()} disabled={busy}>
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder='Descreva o que quer na página… (ex: "adicione uma garantia de 30 dias")'
          rows={2}
          className="resize-none border-0 focus-visible:ring-0"
          disabled={busy}
        />
        <Button onClick={send} disabled={busy || (!input.trim() && !pendingImage)}
          className="bg-gradient-primary text-primary-foreground shadow-glow">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  const previewPane = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        <Eye className="h-3.5 w-3.5 text-primary" /> Preview em tempo real
        <span className="ml-auto flex gap-2">
          {pageId && (
            <Link to="/sales-pages/$id/edit" params={{ id: pageId }}
              className="inline-flex items-center gap-1 text-primary hover:underline">
              <PencilRuler className="h-3 w-3" /> Editor completo
            </Link>
          )}
          {slug && (
            <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Ver página
            </a>
          )}
        </span>
      </div>
      {blocks ? (
        <iframe srcDoc={previewHtml} className="h-full w-full flex-1 bg-white" title="preview da página" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
          <Sparkles className="h-8 w-8 text-primary/50" />
          A página aparece aqui conforme você conversa com a IA.
        </div>
      )}
    </div>
  );

  return (
    <DashboardShell title="Construtor com IA (chat)">
      <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-7xl flex-col gap-3">
        {/* Toggle mobile: chat / preview */}
        <div className="flex gap-2 lg:hidden">
          <Button variant={mobileTab === "chat" ? "default" : "outline"} size="sm" className="flex-1"
            onClick={() => setMobileTab("chat")}>
            <MessageSquare className="mr-2 h-4 w-4" /> Chat
          </Button>
          <Button variant={mobileTab === "preview" ? "default" : "outline"} size="sm" className="flex-1"
            onClick={() => setMobileTab("preview")}>
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
        </div>

        {/* Desktop: lado a lado. Mobile: um por vez */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
          <div className={`min-h-0 ${mobileTab === "chat" ? "" : "hidden lg:block"}`}>{chatPane}</div>
          <div className={`min-h-0 ${mobileTab === "preview" ? "" : "hidden lg:block"}`}>{previewPane}</div>
        </div>
      </div>
    </DashboardShell>
  );
}
