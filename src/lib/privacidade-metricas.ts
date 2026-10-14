/** Política para impedir os coletores externos inseridos pela hospedagem.
 * Vale para documentos HTML de produção; também protege mudanças internas de rota.
 * Inline/eval e workers existentes permanecem permitidos: não é uma defesa completa de XSS.
 */
export function protegerMetricas(request: Request, response: Response): Response {
  if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) return response;
  const url = new URL(request.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") return response;
  const headers = new Headers(response.headers);
  // Políticas anteriores continuam valendo; a política adicional não as amplia.
  headers.append("Content-Security-Policy", `script-src 'unsafe-inline' 'unsafe-eval' ${url.origin}/assets/; worker-src 'self' blob:`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
