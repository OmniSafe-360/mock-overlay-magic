import { createFileRoute } from "@tanstack/react-router";
import { PaginaFiadoCliente } from "@/components/PaginaFiadoCliente";

/* Link do fiado para o cliente (P2): abre sem login, com PIN. */
export const Route = createFileRoute("/fiado/$token")({
  head: () => ({
    meta: [
      { title: "Minha conta no fiado — Omni Safe 360" },
      { name: "description", content: "Veja quanto você deve no fiado, com suas compras e pagamentos." },
      { property: "og:title", content: "Minha conta no fiado" },
      { property: "og:description", content: "Veja quanto você deve no fiado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { token } = Route.useParams();
  return <PaginaFiadoCliente token={token} />;
}
