import { createFileRoute } from "@tanstack/react-router";
import { PaginaFornecedor } from "@/components/PaginaFornecedor";

/* Link do pedido para o fornecedor (D2b): abre sem login. */
export const Route = createFileRoute("/pedido/$token")({
  head: () => ({
    meta: [
      { title: "Pedido de compra — Omni Safe 360" },
      { name: "description", content: "Veja o pedido e confirme a entrega." },
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
