// TEMPORÁRIO: bancada de capturas da M19. Remover após as capturas.
import { createFileRoute } from "@tanstack/react-router";
import { ConferirDeposito, type ApiConferir } from "@/components/ConferirDeposito";

export const Route = createFileRoute("/zz-harness-m19")({ component: Bancada });

function Bancada() {
  const modo = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("modo") ?? "lista" : "lista";
  const tipo = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tipo") ?? "mercado" : "mercado";
  const item = { produtoId: "p1", variacaoId: null, embalagemId: null, nome: "Achocolatado em pó Nescau lata 350 g", unidade: "Unidade", codigo: "7891000412855",
    variacao: null, controlaValidade: false, pedeLote: false, embalagens: [], local: "Prateleira 10", conferenciaId: null };
  const api: ApiConferir = {
    lista: async () => ({ tipo, feitosHoje: 1, meta: 5, produtos: [item] }),
    contar: async () => (modo === "recontar" ? { situacao: "recontar", rodada: 2 } : modo === "diferenca" ? { situacao: "aguardando_dono" } : { situacao: "inconsistente" }) as never,
    buscar: async () => [],
  };
  return <div className="mx-auto max-w-md p-4"><ConferirDeposito chave={"c".repeat(64)} api={api} onVoltar={() => {}} /></div>;
}
