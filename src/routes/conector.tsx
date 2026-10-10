import { createFileRoute } from "@tanstack/react-router";
import { OmniConector } from "@/components/OmniConector";

/* Omni Conector (Fase 3.3): aberto no computador do caixa, manda ao Omni cada venda finalizada. */
export const Route = createFileRoute("/conector")({
  head: () => ({
    meta: [
      { title: "Omni Conector — caixa" },
      { name: "description", content: "Liga o caixa do comércio ao Omni Safe 360: cada venda finalizada sai da gôndola na hora." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: () => <OmniConector />,
});
