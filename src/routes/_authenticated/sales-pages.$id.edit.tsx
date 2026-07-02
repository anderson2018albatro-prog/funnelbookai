import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Eye, EyeOff,
  Loader2, Plus, RefreshCw, Save, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import {
  BLOCK_LABELS, DEFAULT_ORDER, THEME_LABELS, backfillBlocks, buildBlocksFromAI, renderBlocksToHtml,
  type BlockKey, type SalesBlocks, type SalesTheme,
} from "@/lib/sales-blocks";

const THEME_SWATCHES: Record<SalesTheme, string> = {
  clean: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  dark: "linear-gradient(135deg,#0b1020,#c9a227)",
  highconvert: "linear-gradient(135deg,#dc2626,#facc15)",
};

export const Route = createFileRoute("/_authenticated/sales-pages/$id/edit")({
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [blocks, setBlocks] = useState<SalesBlocks | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiTarget, setAiTarget] = useState<BlockKey | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [regenTarget, setRegenTarget] = useState<BlockKey | null>(null);

  const pageQ = useQuery({
    queryKey: ["sales-page", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_pages").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => ((q.state.data as any)?.status === "processing" ? 3000 : false),
  });

  useEffect(() => {
    if (!pageQ.data) return;
    const status = (pageQ.data as any).status as string;
    const b = (pageQ.data as any).blocks as SalesBlocks | null;
    if (b && b.data) {
      setBlocks(backfillBlocks(b));
    } else if (status !== "processing") {
      setBlocks(buildBlocksFromAI({}, pageQ.data.title));
    }
  }, [pageQ.data?.id, (pageQ.data as any)?.status]);

  const isProcessing = (pageQ.data as any)?.status === "processing";

  if (pageQ.isLoading || (!blocks && !isProcessing))
    return (<DashboardShell title="Editor"><div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></DashboardShell>);

  if (isProcessing && !blocks)
    return (
      <DashboardShell title="Editor — Gerando…">
        <div className="mx-auto max-w-2xl p-8 text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div className="font-medium">A IA está gerando sua página de vendas…</div>
          <div className="text-sm text-muted-foreground">Isso leva 30–60 segundos. Esta tela atualiza automaticamente.</div>
        </div>
      </DashboardShell>
    );

  const page = pageQ.data!;

  function updateBlock<K extends BlockKey>(key: K, patch: Partial<SalesBlocks["data"][K]>) {
    setBlocks((prev) => prev && ({ ...prev, data: { ...prev.data, [key]: { ...prev.data[key], ...patch } } }));
  }
  function moveBlock(key: BlockKey, dir: -1 | 1) {
    setBlocks((prev) => {
      if (!prev) return prev;
      const order = [...prev.order];
      const i = order.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return prev;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...prev, order };
    });
  }
  function toggleVisible(key: BlockKey) {
    const cur = (blocks!.data as any)[key];
    updateBlock(key, { visible: !cur.visible } as any);
  }

  async function save() {
    if (!blocks) return;
    setSaving(true);
    try {
      const html = renderBlocksToHtml(blocks, page.title);
      const newTitle = blocks.data.hero.headline || page.title;
      const { error } = await supabase.from("sales_pages")
        .update({ blocks, html_content: html, title: newTitle })
        .eq("id", id);
      if (error) throw error;
      toast.success("Página salva");
      qc.invalidateQueries({ queryKey: ["sales-page", id] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sessão expirada"); return null; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${u.user.id}/${id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("sales-assets").upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); return null; }
    const { data: signed, error: sErr } = await supabase.storage.from("sales-assets")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr || !signed) { toast.error("Falha ao gerar URL"); return null; }
    return signed.signedUrl;
  }

  async function runAI(key: BlockKey) {
    if (!aiInstruction.trim()) return;
    const b: any = (blocks!.data as any)[key];
    setAiBusy(true);
    try {
      let mode: "text" | "list" | "faq" = "text";
      let content: any = b.text ?? b.headline ?? b.subheadline ?? b.description ?? "";
      if (key === "beneficios" || key === "para_quem" || key === "aprendizado" || key === "bonus") {
        mode = "list"; content = b.items;
      } else if (key === "faq") { mode = "faq"; content = b.items; }
      const { data, error } = await supabase.functions.invoke("improve-copy", {
        body: { instruction: aiInstruction, content, mode },
      });
      if (error) {
        let m = error.message;
        try { const c: any = (error as any).context; if (c?.json) { const j = await c.json(); if (j?.error) m = j.error; } } catch {}
        throw new Error(m);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = (data as any).result;
      if (mode === "list" && Array.isArray(result)) updateBlock(key, { items: result } as any);
      else if (mode === "faq" && Array.isArray(result)) updateBlock(key, { items: result } as any);
      else if (mode === "text") {
        if ("text" in b) updateBlock(key, { text: result } as any);
        else if ("headline" in b) updateBlock(key, { headline: result } as any);
        else if ("subheadline" in b) updateBlock(key, { subheadline: result } as any);
        else if ("description" in b) updateBlock(key, { description: result } as any);
      }
      toast.success("Atualizado pela IA");
      setAiInstruction("");
      setAiTarget(null);
    } catch (e: any) { toast.error(e.message); } finally { setAiBusy(false); }
  }

  // Regenera UMA seção via IA sem refazer a página toda
  async function regenerateSection(key: BlockKey) {
    setRegenTarget(key);
    try {
      const { data, error } = await supabase.functions.invoke("generate-sales-page-from-prompt", {
        body: { action: "regenerate_section", page_id: id, section: key, instruction: aiTarget === key ? aiInstruction : "" },
      });
      if (error) {
        let m = error.message;
        try { const c: any = (error as any).context; if (c?.json) { const j = await c.json(); if (j?.error) m = j.error; } } catch { /* noop */ }
        throw new Error(m);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const block = (data as any).block;
      if (block) updateBlock(key, block);
      toast.success(`Seção "${BLOCK_LABELS[key]}" regenerada`);
      setAiInstruction("");
      qc.invalidateQueries({ queryKey: ["sales-page", id] });
    } catch (e: any) { toast.error(e.message); } finally { setRegenTarget(null); }
  }

  const previewHtml = blocks ? renderBlocksToHtml(blocks, page.title) : "";

  return (
    <DashboardShell title={`Editor — ${page.title}`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center gap-2">
          {page.ebook_id ? (
            <Link to="/ebooks/$id" params={{ id: page.ebook_id }}>
              <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao ebook</Button>
            </Link>
          ) : (
            <Link to="/sales-pages">
              <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
            </Link>
          )}
          <a href={`/p/${page.slug}`} target="_blank" rel="noopener" className="ml-auto">
            <Button variant="outline" size="sm"><ExternalLink className="mr-2 h-4 w-4" /> Ver página pública</Button>
          </a>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>

        {isProcessing && (
          <div className="mb-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            Gerando conteúdo com IA… A página atualiza automaticamente quando terminar.
          </div>
        )}
        {(page as any).status === "failed" && (
          <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Falha na geração: {(page as any).error_message}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
          {/* Editor */}
          <div className="space-y-3">
            {/* Tema visual */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <Label>Tema visual</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(Object.keys(THEME_LABELS) as SalesTheme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBlocks((prev) => prev && ({ ...prev, theme: t }))}
                    className={`rounded-xl border p-2 text-left text-xs transition-all ${
                      (blocks!.theme ?? "clean") === t ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <div className="mb-1.5 h-6 w-full rounded" style={{ background: THEME_SWATCHES[t] }} />
                    <div className="font-semibold">{THEME_LABELS[t]}</div>
                  </button>
                ))}
              </div>
            </div>

            {blocks!.order.map((key) => {
              const b: any = (blocks!.data as any)[key];
              return (
                <div key={key} className={`rounded-2xl border bg-card p-4 ${b.visible ? "border-border" : "border-dashed border-muted opacity-60"}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-display font-semibold">{BLOCK_LABELS[key]}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => moveBlock(key, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => moveBlock(key, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleVisible(key)}>
                        {b.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" title="Regenerar seção com IA" onClick={() => regenerateSection(key)} disabled={regenTarget === key}>
                        {regenTarget === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-primary" />}
                      </Button>
                      <Button size="icon" variant="ghost" title="Melhorar com instrução" onClick={() => setAiTarget(aiTarget === key ? null : key)}>
                        <Sparkles className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                  </div>

                  <BlockEditor blockKey={key} block={b} update={(p) => updateBlock(key, p as any)} uploadImage={uploadImage} />

                  {aiTarget === key && (
                    <div className="mt-3 rounded-lg border border-primary/40 bg-gradient-card p-3">
                      <Label className="text-xs">Melhorar com IA</Label>
                      <div className="mt-2 flex gap-2">
                        <Input
                          placeholder="Ex.: deixe mais persuasivo / traduza para inglês / use tom profissional"
                          value={aiInstruction}
                          onChange={(e) => setAiInstruction(e.target.value)}
                        />
                        <Button onClick={() => runAI(key)} disabled={aiBusy} className="bg-gradient-primary text-primary-foreground">
                          {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" title="Regenerar a seção inteira seguindo a instrução" onClick={() => regenerateSection(key)} disabled={regenTarget === key}>
                          {regenTarget === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {["mais persuasiva", "mais profissional", "mais agressiva", "tom amigável", "traduzir para inglês"].map((p) => (
                          <Button key={p} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAiInstruction(p)}>{p}</Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview */}
          <div className="sticky top-4 h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border bg-surface px-3 py-2 text-xs text-muted-foreground">Pré-visualização</div>
            <iframe srcDoc={previewHtml} className="h-full w-full" title="preview" />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function BlockEditor({
  blockKey, block, update, uploadImage,
}: {
  blockKey: BlockKey;
  block: any;
  update: (patch: any) => void;
  uploadImage: (f: File) => Promise<string | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  switch (blockKey) {
    case "hero":
      return (
        <div className="space-y-2">
          <Input value={block.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="Headline" />
          <Textarea value={block.subheadline} onChange={(e) => update({ subheadline: e.target.value })} placeholder="Subheadline" rows={2} />
          <Input value={block.cta_text} onChange={(e) => update({ cta_text: e.target.value })} placeholder="Texto do botão" />
        </div>
      );
    case "product":
      return (
        <div className="space-y-2">
          <Label className="text-xs">Imagem do produto</Label>
          <div className="flex items-center gap-2">
            {block.image_url && <img src={block.image_url} alt="" className="h-16 w-16 rounded object-cover" />}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setUploading(true);
              const url = await uploadImage(f);
              setUploading(false);
              if (url) update({ image_url: url, visible: true });
              if (fileRef.current) fileRef.current.value = "";
            }} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />} Enviar imagem
            </Button>
            {block.image_url && (
              <Button variant="ghost" size="sm" onClick={() => update({ image_url: "" })}><X className="h-3 w-3" /></Button>
            )}
          </div>
          <Label className="text-xs">URL de vídeo (YouTube/Vimeo)</Label>
          <Input value={block.video_url} onChange={(e) => update({ video_url: e.target.value, visible: true })} placeholder="https://youtube.com/watch?v=..." />
        </div>
      );
    case "promessa":
    case "garantia":
    case "dor":
    case "urgencia":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          <Textarea value={block.text} onChange={(e) => update({ text: e.target.value })} rows={blockKey === "dor" ? 5 : 3} placeholder="Texto" />
        </div>
      );
    case "video_vsl":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título da seção" />
          <Input value={block.video_url} onChange={(e) => update({ video_url: e.target.value })} placeholder="URL do vídeo (YouTube/Vimeo)" />
          <Input value={block.placeholder_text} onChange={(e) => update({ placeholder_text: e.target.value })} placeholder="Texto do placeholder (antes de ter vídeo)" />
        </div>
      );
    case "mecanismo":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título da seção" />
          <Input value={block.nome} onChange={(e) => update({ nome: e.target.value })} placeholder='Nome do mecanismo (ex.: "Método Trinca 3x7")' />
          <Textarea value={block.text} onChange={(e) => update({ text: e.target.value })} rows={4} placeholder="Descrição de por que funciona" />
        </div>
      );
    case "stack":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          {(block.items || []).map((it: any, i: number) => (
            <div key={i} className="grid grid-cols-[1fr,110px,auto] gap-1">
              <Input value={it.item} placeholder="Item da oferta" onChange={(e) => {
                const items = [...block.items]; items[i] = { ...it, item: e.target.value }; update({ items });
              }} />
              <Input value={it.valor} placeholder="R$497" onChange={(e) => {
                const items = [...block.items]; items[i] = { ...it, valor: e.target.value }; update({ items });
              }} />
              <Button size="icon" variant="ghost" onClick={() => update({ items: block.items.filter((_: any, x: number) => x !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => update({ items: [...(block.items || []), { item: "", valor: "" }] })}>
            <Plus className="mr-1 h-3 w-3" /> Item
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Input value={block.total_value} onChange={(e) => update({ total_value: e.target.value })} placeholder="Valor total ancorado (R$1.244)" />
            <Input value={block.price} onChange={(e) => update({ price: e.target.value })} placeholder="Preço real (12x R$9,74)" />
          </div>
          <Input value={block.anchor_text} onChange={(e) => update({ anchor_text: e.target.value })} placeholder="Frase de ancoragem" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={block.cta_text} onChange={(e) => update({ cta_text: e.target.value })} placeholder="Texto do botão" />
            <Input value={block.cta_url} onChange={(e) => update({ cta_url: e.target.value })} placeholder="Link do checkout" />
          </div>
        </div>
      );
    case "beneficios":
    case "para_quem":
    case "aprendizado":
    case "bonus":
      return <ListEditor block={block} update={update} />;
    case "depoimentos":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          {block.items.map((t: any, i: number) => (
            <div key={i} className="space-y-1 rounded border border-border p-2">
              <Input value={t.name} placeholder="Nome" onChange={(e) => {
                const items = [...block.items]; items[i] = { ...t, name: e.target.value }; update({ items });
              }} />
              <Textarea value={t.text} placeholder="Depoimento" rows={2} onChange={(e) => {
                const items = [...block.items]; items[i] = { ...t, text: e.target.value }; update({ items });
              }} />
              <Button size="sm" variant="ghost" onClick={() => update({ items: block.items.filter((_: any, x: number) => x !== i) })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => update({ items: [...block.items, { name: "", text: "" }] })}>
            <Plus className="mr-1 h-3 w-3" /> Adicionar depoimento
          </Button>
        </div>
      );
    case "oferta":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          <Textarea value={block.description} onChange={(e) => update({ description: e.target.value })} rows={2} placeholder="Descrição da oferta" />
          <Input value={block.price} onChange={(e) => update({ price: e.target.value })} placeholder="Preço (ex.: R$ 47,00)" />
          <Input value={block.cta_text} onChange={(e) => update({ cta_text: e.target.value })} placeholder="Texto do botão" />
          <Input value={block.cta_url} onChange={(e) => update({ cta_url: e.target.value })} placeholder="Link do botão (pagamento)" />
        </div>
      );
    case "faq":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          {block.items.map((f: any, i: number) => (
            <div key={i} className="space-y-1 rounded border border-border p-2">
              <Input value={f.pergunta} placeholder="Pergunta" onChange={(e) => {
                const items = [...block.items]; items[i] = { ...f, pergunta: e.target.value }; update({ items });
              }} />
              <Textarea value={f.resposta} placeholder="Resposta" rows={2} onChange={(e) => {
                const items = [...block.items]; items[i] = { ...f, resposta: e.target.value }; update({ items });
              }} />
              <Button size="sm" variant="ghost" onClick={() => update({ items: block.items.filter((_: any, x: number) => x !== i) })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => update({ items: [...block.items, { pergunta: "", resposta: "" }] })}>
            <Plus className="mr-1 h-3 w-3" /> Adicionar pergunta
          </Button>
        </div>
      );
    case "final_cta":
      return (
        <div className="space-y-2">
          <Input value={block.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="Headline final" />
          <Input value={block.cta_text} onChange={(e) => update({ cta_text: e.target.value })} placeholder="Texto do botão" />
          <Input value={block.cta_url} onChange={(e) => update({ cta_url: e.target.value })} placeholder="Link do botão" />
        </div>
      );
  }
}

function ListEditor({ block, update }: { block: any; update: (p: any) => void }) {
  return (
    <div className="space-y-2">
      <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
      {block.items.map((item: string, i: number) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={(e) => {
            const items = [...block.items]; items[i] = e.target.value; update({ items });
          }} />
          <Button size="icon" variant="ghost" onClick={() => update({ items: block.items.filter((_: string, x: number) => x !== i) })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => update({ items: [...block.items, ""] })}>
        <Plus className="mr-1 h-3 w-3" /> Adicionar item
      </Button>
    </div>
  );
}

// Avoid unused-import lint
void Switch; void DEFAULT_ORDER;
