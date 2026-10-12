import { createFileRoute } from "@tanstack/react-router";

/* Manifesto do app "Omni Safe Cliente". Cada cliente tem o próprio link: o ícone instalado abre direto
 * na conta dele (start_url com o link). Não lê nada do banco; o PIN continua sendo exigido na página. */
export const Route = createFileRoute("/api/public/fiado-manifest/$token")({
  server: {
    handlers: {
      GET: ({ params }) => {
        const token = /^[A-Za-z0-9_-]{16,128}$/.test(params.token) ? params.token : "";
        const manifesto = {
          id: "/fiado/",
          name: "Omni Safe Cliente",
          short_name: "Omni Cliente",
          description: "Sua conta no fiado: quanto deve, compras e pagamentos.",
          start_url: token ? `/fiado/${token}` : "/fiado/",
          scope: "/fiado/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#071326",
          theme_color: "#071326",
          lang: "pt-BR",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        };
        return new Response(JSON.stringify(manifesto), {
          headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
        });
      },
    },
  },
});
