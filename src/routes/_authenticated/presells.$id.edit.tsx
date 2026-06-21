import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Eye, EyeOff, Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import {
  PRESELL_LABELS, emptyPresell, renderPresellHtml,
  type PresellBlockKey, type PresellBlocks, type PresellType,
} from "@/lib/presell-blocks";

export const Route = createFileRoute("/_authenticated/presells/$id/edit")({
  component: EditPresell,
});

function EditPresell() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [blocks, setBlocks] = useState<PresellBlocks | null>(null);
  const [affUrl, setAffUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const pageQ = useQuery({
    queryKey: ["presell", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("presells").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => ((q.state.data as any)?.status === "processing" ? 3000 : false),
  });

  useEffect(() => {
    if (!pageQ.data) return;
    const b = (pageQ.data as any).blocks as PresellBlocks | null;
    if (b && b.data) setBlocks(b);
    else setBlocks(emptyPresell((pageQ.data as any).presell_type as PresellType, (pageQ.data as any).affiliate_url));
    setAffUrl((pageQ.data as any).affiliate_url || "");
  }, [pageQ.data?.id, (pageQ.data as any)?.status]);

  if (pageQ.isLoading || !blocks)
    return (<DashboardShell title="Editor"><div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></DashboardShell>);

  const page = pageQ.data!;

  function update<K extends PresellBlockKey>(key: K, patch: Partial<PresellBlocks["data"][K]>) {
    setBlocks((prev) => prev && ({ ...prev, data: { ...prev.data, [key]: { ...prev.data[key], ...patch } as any } }));
  }
  function move(key: PresellBlockKey, dir: -1 | 1) {
    setBlocks((prev) => {
      if (!prev) return prev;
      const order = [...prev.order];
      const i = order.indexOf(key), j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return prev;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...prev, order };
    });
  }
  function toggle(key: PresellBlockKey) {
    const cur: any = (blocks!.data as any)[key];
    update(key, { visible: !cur.visible } as any);
  }

  async function save() {
    if (!blocks) return;
    setSaving(true);
    try {
      const b: PresellBlocks = { ...blocks, affiliate_url: affUrl || "#" };
      const title = b.data.headline.title || (page as any).title;
      const html = renderPresellHtml(b, title);
      const { error } = await supabase.from("presells")
        .update({ blocks: b, html_content: html, title, affiliate_url: affUrl || "#" }).eq("id", id);
      if (error) throw error;
      toast.success("Presell salva");
      qc.invalidateQueries({ queryKey: ["presell", id] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sessão expirada"); return null; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${u.user.id}/presell-${id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("sales-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return null; }
    const { data: signed } = await supabase.storage.from("sales-assets").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return signed?.signedUrl ?? null;
  }

  const previewHtml = renderPresellHtml({ ...blocks, affiliate_url: affUrl || "#" }, (page as any).title);
  const isProcessing = (page as any).status === "processing";

  return (
    <DashboardShell title={`Editor — ${(page as any).title}`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center gap-2">
          <Link to="/presells"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button></Link>
          <a href={`/pre/${(page as any).slug}`} target="_blank" rel="noopener" className="ml-auto">
            <Button variant="outline" size="sm"><ExternalLink className="mr-2 h-4 w-4" /> Ver página pública</Button>
          </a>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar
          </Button>
        </div>

        {isProcessing && (
          <div className="mb-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Gerando conteúdo com IA…
          </div>
        )}
        {(page as any).status === "failed" && (
          <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            Falha: {(page as any).error_message}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <Label>Link de afiliado (usado em todos os CTAs)</Label>
              <Input value={affUrl} onChange={(e) => setAffUrl(e.target.value)} placeholder="https://..." />
            </div>

            {blocks.order.map((key) => {
              const b: any = (blocks.data as any)[key];
              return (
                <div key={key} className={`rounded-2xl border bg-card p-4 ${b.visible ? "border-border" : "border-dashed border-muted opacity-60"}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-display font-semibold">{PRESELL_LABELS[key]}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => move(key, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => move(key, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => toggle(key)}>
                        {b.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <BlockEditor blockKey={key} block={b} update={(p) => update(key, p as any)} uploadImage={uploadImage} />
                </div>
              );
            })}
          </div>

          <div className="sticky top-4 h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border bg-surface px-3 py-2 text-xs text-muted-foreground">Pré-visualização</div>
            <iframe srcDoc={previewHtml} className="h-full w-full" title="preview" />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function BlockEditor({ blockKey, block, update, uploadImage }: {
  blockKey: PresellBlockKey; block: any; update: (p: any) => void;
  uploadImage: (f: File) => Promise<string | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  switch (blockKey) {
    case "headline":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          <Textarea rows={2} value={block.subtitle} onChange={(e) => update({ subtitle: e.target.value })} placeholder="Subtítulo" />
        </div>
      );
    case "media":
      return (
        <div className="space-y-2">
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
            {block.image_url && <Button variant="ghost" size="sm" onClick={() => update({ image_url: "" })}><X className="h-3 w-3" /></Button>}
          </div>
        </div>
      );
    case "intro":
    case "cookie_notice":
      return <Textarea rows={3} value={block.text} onChange={(e) => update({ text: e.target.value })} placeholder="Texto" />;
    case "what_is":
    case "story":
    case "how_it_works":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          <Textarea rows={3} value={block.text} onChange={(e) => update({ text: e.target.value })} placeholder="Texto" />
        </div>
      );
    case "for_whom":
    case "benefits":
    case "pros":
    case "cons":
    case "proof":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          {(block.items || []).map((item: string, i: number) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={(e) => {
                const items = [...block.items]; items[i] = e.target.value; update({ items });
              }} />
              <Button size="icon" variant="ghost" onClick={() => update({ items: block.items.filter((_: string, x: number) => x !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => update({ items: [...(block.items || []), ""] })}>
            <Plus className="mr-1 h-3 w-3" /> Adicionar
          </Button>
        </div>
      );
    case "comparison":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={block.product_a} onChange={(e) => update({ product_a: e.target.value })} placeholder="Produto A" />
            <Input value={block.product_b} onChange={(e) => update({ product_b: e.target.value })} placeholder="Produto B" />
          </div>
          {(block.rows || []).map((r: any, i: number) => (
            <div key={i} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-1">
              <Input value={r.feature} placeholder="Critério" onChange={(e) => { const rows = [...block.rows]; rows[i] = { ...r, feature: e.target.value }; update({ rows }); }} />
              <Input value={r.a} placeholder="A" onChange={(e) => { const rows = [...block.rows]; rows[i] = { ...r, a: e.target.value }; update({ rows }); }} />
              <Input value={r.b} placeholder="B" onChange={(e) => { const rows = [...block.rows]; rows[i] = { ...r, b: e.target.value }; update({ rows }); }} />
              <Button size="icon" variant="ghost" onClick={() => update({ rows: block.rows.filter((_: any, x: number) => x !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => update({ rows: [...(block.rows || []), { feature: "", a: "", b: "" }] })}>
            <Plus className="mr-1 h-3 w-3" /> Linha
          </Button>
          <Input value={block.winner} onChange={(e) => update({ winner: e.target.value })} placeholder="Melhor opção" />
        </div>
      );
    case "quiz":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título do quiz" />
          {(block.questions || []).map((q: any, i: number) => (
            <div key={i} className="rounded border border-border p-2">
              <Input value={q.question} placeholder="Pergunta" onChange={(e) => {
                const qs = [...block.questions]; qs[i] = { ...q, question: e.target.value }; update({ questions: qs });
              }} />
              <Textarea rows={2} className="mt-1" value={(q.options || []).join("\n")}
                placeholder="Uma opção por linha"
                onChange={(e) => {
                  const qs = [...block.questions]; qs[i] = { ...q, options: e.target.value.split("\n").filter(Boolean) }; update({ questions: qs });
                }} />
              <Button size="sm" variant="ghost" onClick={() => update({ questions: block.questions.filter((_: any, x: number) => x !== i) })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => update({ questions: [...(block.questions || []), { question: "", options: [] }] })}>
            <Plus className="mr-1 h-3 w-3" /> Pergunta
          </Button>
          <Textarea rows={2} value={block.result} onChange={(e) => update({ result: e.target.value })} placeholder="Recomendação final" />
        </div>
      );
    case "video":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" />
          <Input value={block.video_url} onChange={(e) => update({ video_url: e.target.value })} placeholder="URL YouTube/Vimeo" />
        </div>
      );
    case "cta":
      return (
        <div className="space-y-2">
          <Input value={block.text} onChange={(e) => update({ text: e.target.value })} placeholder="Texto do botão" />
          <Textarea rows={2} value={block.note} onChange={(e) => update({ note: e.target.value })} placeholder="Nota abaixo do botão" />
          <p className="text-xs text-muted-foreground">O link de afiliado é definido no topo. Toda CTA usa esse link.</p>
        </div>
      );
  }
}
