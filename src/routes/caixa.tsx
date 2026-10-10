import { createFileRoute } from "@tanstack/react-router";
import { AppFuncionario } from "@/components/AppFuncionario";

/* "Omni Caixa" (C4): o mesmo app da equipe, que abre direto no caixa. Tem nome e ícone próprios na tela do celular. */
export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "Omni Caixa" },
      { name: "description", content: "Caixa no celular da equipe: bipar, receber e finalizar a venda." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
      { name: "apple-mobile-web-app-title", content: "Omni Caixa" },
    ],
    links: [{ rel: "manifest", href: "/manifest-caixa.webmanifest" }, { rel: "apple-touch-icon", href: "/apple-touch-icon-caixa.png" }],
  }),
  component: () => <AppFuncionario modoCaixa />,
});
