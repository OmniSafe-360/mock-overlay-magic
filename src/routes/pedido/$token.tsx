import { createFileRoute } from "@tanstack/react-router";
import { PaginaFornecedor } from "@/components/PaginaFornecedor";

/* Link do pedido para o fornecedor (D2b): abre sem login. */
export const Route = createFileRoute("/pedido/$token")({
  head: () => ({
    meta: [
      { title: "Pedido de compra | OmniSafe 360°" },
      { name: "description", content: "Consulte os produtos solicitados e confirme o pedido com segurança." },
      { property: "og:title", content: "Pedido de compra | OmniSafe 360°" },
      { property: "og:description", content: "Consulte os produtos solicitados e confirme o pedido com segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Pedido de compra | OmniSafe 360°" },
      { name: "twitter:description", content: "Consulte os produtos solicitados e confirme o pedido com segurança." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { token } = Route.useParams();
  return <PaginaFornecedor token={token} />;
}
