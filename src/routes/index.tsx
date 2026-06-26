import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Check, Link2, Megaphone, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FunnelBook AI — Ebooks, páginas de vendas e presells com IA" },
      {
        name: "description",
        content:
          "Crie ebooks profissionais, páginas de vendas de alta conversão e presells éticas de afiliado em minutos com inteligência artificial.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="truncate font-display text-base font-semibold sm:text-lg">
              FunnelBook <span className="text-gradient">AI</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                Começar grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24 md:py-32">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Powered by Gemini 2.5 Flash
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Seu produto digital completo{" "}
            <span className="text-gradient">em minutos</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            FunnelBook AI cria ebooks profissionais, páginas de vendas que convertem e presells éticas de afiliado
            — tudo com IA e um único clique.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
            <Link to="/auth">
              <Button size="lg" className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto">
                Criar meu primeiro ebook <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Já tenho conta
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito · Começa grátis</p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Tudo que você precisa para vender online</h2>
          <p className="mt-2 text-sm text-muted-foreground">Da ideia à venda, sem precisar escrever uma palavra.</p>
        </div>
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: BookOpen,
              title: "Ebook completo",
              desc: "Título, sumário, capítulos e conclusão escritos pela IA no seu idioma. Baixe em PDF com um clique.",
              color: "bg-primary/10 text-primary",
            },
            {
              icon: Megaphone,
              title: "Página de vendas",
              desc: "Headline persuasiva, benefícios, FAQ e CTA prontos para converter. URL pública instantânea.",
              color: "bg-blue-500/10 text-blue-500",
            },
            {
              icon: Link2,
              title: "Presell de afiliado",
              desc: "Reviews, advertoriais, quizzes e bridge pages éticos. Sem cookie stuffing, sem redirecionamento invisível.",
              color: "bg-green-500/10 text-green-500",
            },
            {
              icon: Zap,
              title: "Geração em segundos",
              desc: "IA com Gemini 2.5 Flash gera conteúdo profissional em 30–60 segundos, não em dias.",
              color: "bg-amber-500/10 text-amber-500",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant sm:p-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${f.color}`}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-y border-border bg-surface py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Como funciona</h2>
            <p className="mt-2 text-sm text-muted-foreground">3 passos do briefing ao produto pronto para vender.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Descreva sua ideia",
                desc: "Use o Assistente IA para conversar e montar o briefing, ou preencha o formulário com tema, público e promessa do produto.",
              },
              {
                step: "02",
                title: "A IA gera tudo",
                desc: "Em segundos, o Gemini 2.5 Flash escreve o ebook completo, a página de vendas com blocos editáveis, ou a presell de afiliado.",
              },
              {
                step: "03",
                title: "Publique e compartilhe",
                desc: "Cada produto ganha uma URL pública instantânea. Edite bloco a bloco, baixe o PDF e compartilhe com seu público.",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-lg font-bold text-primary-foreground shadow-glow">
                  {s.step}
                </div>
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tipos de presell */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Presells éticas para afiliados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Todos os modelos que o mercado usa, gerados com IA e sem práticas proibidas.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Review", desc: "Análise honesta do produto com prós e contras" },
            { label: "Advertorial", desc: "Artigo editorial que aquece o lead para a oferta" },
            { label: "Quiz", desc: "Pergunta + resultado que leva ao produto ideal" },
            { label: "Bridge Page", desc: "Ponte simples entre o anúncio e a página de vendas" },
            { label: "Comparativo", desc: "Compara soluções e posiciona o produto analisado" },
            { label: "VSL Page", desc: "Página de vídeo de vendas com transcrição e CTA" },
            { label: "Cookie Notice", desc: "Página de aviso de cookies com redirecionamento ético" },
            { label: "+ outros", desc: "A IA adapta o formato ao seu nicho e público" },
          ].map((t) => (
            <div key={t.label} className="rounded-xl border border-border bg-card p-4">
              <div className="font-display text-sm font-semibold">{t.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="rounded-3xl border border-border bg-gradient-card p-6 text-center shadow-elegant sm:p-10">
          <h2 className="font-display text-2xl font-bold sm:text-3xl md:text-4xl">
            Pronto para lançar seu produto digital?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Crie sua conta gratuita e gere seu primeiro ebook em menos de 5 minutos.
          </p>
          <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left text-sm text-muted-foreground">
            {[
              "Ebook completo com capítulos e PDF",
              "Página de vendas responsiva e editável",
              "Presell ética de afiliado com URL pública",
              "Sem cookie stuffing nem práticas proibidas",
            ].map((p) => (
              <li key={p} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-success" /> {p}
              </li>
            ))}
          </ul>
          <Link to="/auth">
            <Button size="lg" className="mt-8 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto">
              Começar agora — é grátis
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FunnelBook AI · Todos os direitos reservados
      </footer>
    </div>
  );
}
