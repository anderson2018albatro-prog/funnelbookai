import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, BookOpen, Megaphone, Zap, Check, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FunnelBook AI — Ebooks e páginas de vendas com IA" },
      { name: "description", content: "Crie ebooks profissionais completos e páginas de vendas de alta conversão em minutos com inteligência artificial." },
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
            <span className="truncate font-display text-base font-semibold sm:text-lg">FunnelBook <span className="text-gradient">AI</span></span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/auth"><Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">Começar</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24 md:py-32">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Powered by Lovable AI
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-7xl">
            Crie um ebook completo e uma <span className="text-gradient">página de vendas</span> em minutos.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            FunnelBook AI escreve, estrutura e publica seu produto digital de ponta a ponta. Você só precisa descrever sua ideia.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
            <Link to="/auth">
              <Button size="lg" className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto">
                Criar meu primeiro ebook <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth"><Button size="lg" variant="outline" className="w-full sm:w-auto">Já tenho conta</Button></Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: BookOpen, title: "Ebook completo", desc: "Título, sumário, capítulos e conclusão escritos por IA no seu idioma." },
            { icon: Megaphone, title: "Página de vendas", desc: "Headline, benefícios, FAQ e CTA prontos para converter." },
            { icon: Zap, title: "URL pública", desc: "Cada projeto gera um link instantâneo para compartilhar com seu público." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-3xl border border-border bg-gradient-card p-10 text-center shadow-elegant">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Pronto para lançar seu produto digital?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Crie sua conta gratuita e gere seu primeiro ebook em menos de 5 minutos.</p>
          <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left text-sm text-muted-foreground">
            {["Geração ilimitada de capítulos", "Páginas de vendas responsivas", "Publicação pública instantânea"].map((p) => (
              <li key={p} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p}</li>
            ))}
          </ul>
          <Link to="/auth"><Button size="lg" className="mt-8 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">Começar agora</Button></Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FunnelBook AI
      </footer>
    </div>
  );
}
