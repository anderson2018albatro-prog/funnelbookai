import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Megaphone, ExternalLink, Save, FileDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { generateEbookPdfBrowser } from "@/lib/ebook-pdf-client";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", id).single()).data,
  });
  const { data: ebook, refetch: refetchEbook } = useQuery({
    queryKey: ["ebook", id],
    queryFn: async () => (await supabase.from("ebooks").select("*").eq("project_id", id).maybeSingle()).data,
  });
  const { data: salesPage, refetch: refetchPage } = useQuery({
    queryKey: ["page", id],
    queryFn: async () => (await supabase.from("sales_pages").select("*").eq("project_id", id).maybeSingle()).data,
  });

  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editSub, setEditSub] = useState<string | null>(null);

  async function regenEbook() {
    setBusy("ebook");
    try {
      const { data, error } = await supabase.functions.invoke("generate-ebook", {
        body: { projectId: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await refetchEbook();
      toast.success("Ebook gerado!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar ebook");
    } finally {
      setBusy(null);
    }
  }

  async function makePage() {
    setBusy("page");
    try {
      const { data, error } = await supabase.functions.invoke("generate-sales-page", {
        body: { projectId: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await refetchPage();
      toast.success("Página de vendas criada!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar página");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!ebook) return;
    setBusy("pdf");
    try {
      generateEbookPdfBrowser({
        titulo: ebook.titulo,
        subtitulo: ebook.subtitulo,
        conteudo: ebook.conteudo as any,
      });
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    } finally {
      setBusy(null);
    }
  }

  async function saveEbookMeta() {
    if (!ebook) return;
    const { error } = await supabase.from("ebooks").update({
      titulo: editTitle ?? ebook.titulo,
      subtitulo: editSub ?? ebook.subtitulo,
    }).eq("id", ebook.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["ebook", id] });
  }

  function copyEbookText() {
    if (!ebook) return;
    const c = ebook.conteudo as any;
    const md = [
      `# ${ebook.titulo}`,
      ebook.subtitulo ? `## ${ebook.subtitulo}\n` : "",
      c?.introducao ? `## Introdução\n\n${c.introducao}\n` : "",
      ...(c?.capitulos ?? []).map((cap: any, i: number) => `## Capítulo ${i + 1}: ${cap.titulo}\n\n${cap.conteudo}\n`),
      c?.conclusao ? `## Conclusão\n\n${c.conclusao}\n` : "",
      c?.cta_final ? `\n---\n${c.cta_final}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(md);
    toast.success("Conteúdo copiado!");
  }

  function copyPublicUrl() {
    if (!salesPage?.slug) return;
    const url = `${window.location.origin}/p/${salesPage.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  }

  const conteudo = ebook?.conteudo as any;

  return (
    <DashboardShell title={project?.nome_projeto ?? "Projeto"}>
      <div className="mx-auto max-w-5xl space-y-6">
        {project && (
          <div className="rounded-2xl border border-border bg-gradient-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{project.nicho}</div>
            <h2 className="mt-1 font-display text-2xl font-bold">{project.nome_projeto}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{project.promessa}</p>
          </div>
        )}

        <Tabs defaultValue="ebook">
          <TabsList>
            <TabsTrigger value="ebook">Ebook</TabsTrigger>
            <TabsTrigger value="page">Página de Vendas</TabsTrigger>
          </TabsList>

          <TabsContent value="ebook" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {ebook && (
                <Button variant="outline" onClick={downloadPdf} disabled={busy === "pdf"}>
                  <FileDown className="mr-2 h-4 w-4" />{busy === "pdf" ? "Gerando PDF..." : "Baixar PDF"}
                </Button>
              )}
              <Button onClick={regenEbook} disabled={busy === "ebook"} className="bg-gradient-primary text-primary-foreground shadow-glow">
                <Sparkles className="mr-2 h-4 w-4" />{busy === "ebook" ? "Gerando..." : ebook ? "Regenerar Ebook" : "GERAR EBOOK"}
              </Button>
            </div>

            {ebook ? (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Título</label>
                  <Input value={editTitle ?? ebook.titulo} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Subtítulo</label>
                  <Input value={editSub ?? ebook.subtitulo ?? ""} onChange={(e) => setEditSub(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={saveEbookMeta}><Save className="mr-2 h-4 w-4" />Salvar</Button>
                  <Button size="sm" variant="outline" onClick={copyEbookText}><Copy className="mr-2 h-4 w-4" />Copiar conteúdo</Button>
                </div>

                {conteudo?.introducao && (
                  <section>
                    <h3 className="font-display text-lg font-semibold">Introdução</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{conteudo.introducao}</p>
                  </section>
                )}
                {conteudo?.sumario && (
                  <section>
                    <h3 className="font-display text-lg font-semibold">Sumário</h3>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                      {conteudo.sumario.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ol>
                  </section>
                )}
                {conteudo?.capitulos?.map((c: any, i: number) => (
                  <section key={i} className="border-t border-border pt-4">
                    <h3 className="font-display text-lg font-semibold">Capítulo {i + 1}: {c.titulo}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{c.conteudo}</p>
                  </section>
                ))}
                {conteudo?.conclusao && (
                  <section className="border-t border-border pt-4">
                    <h3 className="font-display text-lg font-semibold">Conclusão</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{conteudo.conclusao}</p>
                  </section>
                )}
                {conteudo?.cta_final && (
                  <section className="border-t border-border pt-4">
                    <h3 className="font-display text-lg font-semibold">Próximo passo</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-primary">{conteudo.cta_final}</p>
                  </section>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
                Nenhum ebook ainda. Clique em "GERAR EBOOK" para criar.
              </div>
            )}
          </TabsContent>

          <TabsContent value="page" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {salesPage?.slug && (
                <Link to="/p/$slug" params={{ slug: salesPage.slug }} target="_blank">
                  <Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Ver página pública</Button>
                </Link>
              )}
              <Button onClick={makePage} disabled={busy === "page" || !ebook} className="bg-gradient-primary text-primary-foreground shadow-glow">
                <Megaphone className="mr-2 h-4 w-4" />{busy === "page" ? "Gerando..." : salesPage ? "Regenerar página" : "GERAR PÁGINA DE VENDAS"}
              </Button>
            </div>

            {!ebook && (
              <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
                Gere o ebook antes de criar a página de vendas.
              </div>
            )}

            {salesPage ? (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
                <div>
                  <h3 className="font-display text-2xl font-bold">{salesPage.headline}</h3>
                  <p className="mt-2 text-muted-foreground">{salesPage.subheadline}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 text-xs">
                  <span>URL pública:</span>
                  <code className="text-primary">/p/{salesPage.slug}</code>
                  <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={copyPublicUrl}>
                    <Copy className="mr-1 h-3 w-3" />Copiar
                  </Button>
                </div>
                <section>
                  <h4 className="font-display font-semibold">Benefícios</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {(salesPage.beneficios as any[])?.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </section>
                <section>
                  <h4 className="font-display font-semibold">O que você aprenderá</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {(salesPage.aprendizados as any[])?.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </section>
                <section>
                  <h4 className="font-display font-semibold">FAQ</h4>
                  <div className="mt-2 space-y-2">
                    {(salesPage.faq as any[])?.map((f, i) => (
                      <div key={i} className="rounded-md border border-border p-3">
                        <div className="text-sm font-medium">{f.pergunta}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{f.resposta}</div>
                      </div>
                    ))}
                  </div>
                </section>
                {salesPage.garantia && (
                  <section>
                    <h4 className="font-display font-semibold">Garantia</h4>
                    <p className="mt-2 text-sm text-muted-foreground">{salesPage.garantia}</p>
                  </section>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
                Nenhuma página gerada. Clique em "Gerar Página de Vendas".
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
