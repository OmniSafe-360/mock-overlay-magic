import { createFileRoute } from "@tanstack/react-router";
import { AppFuncionario } from "@/components/AppFuncionario";

/* App do funcionário "Omni Operação" (E1). O QR Code da aba Equipe abre aqui com o código preenchido. */
export const Route = createFileRoute("/funcionario")({
  validateSearch: (s: Record<string, unknown>): { codigo?: string } => {
    const c = typeof s["codigo"] === "string" || typeof s["codigo"] === "number" ? String(s["codigo"]).replace(/\D/g, "").slice(0, 6) : "";
    return c ? { codigo: c } : {};
  },
  head: () => ({
    meta: [
      { title: "Omni Operação — equipe" },
      { name: "description", content: "App da equipe: receber mercadoria e repor a gôndola." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { codigo } = Route.useSearch();
  return <AppFuncionario codigoInicial={codigo} />;
}
