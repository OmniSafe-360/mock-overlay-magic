import { describe, expect, it } from "vitest";
import { protegerMetricas } from "@/lib/privacidade-metricas";
const html = () => new Response("<html>Teste</html>", { headers: { "content-type": "text/html; charset=utf-8" } });
describe("G1.4-B — bloquear coletores antes da navegação", () => {
  it.each(["/", "/caixa", "/funcionario", "/conector", "/pedido/ficticio", "/fiado/ficticio"])("protege o documento HTML %s", async (path) => {
    const response = protegerMetricas(new Request("https://loja.example" + path), html());
    expect(response.headers.get("content-security-policy")).toBe("script-src 'unsafe-inline' 'unsafe-eval' https://loja.example/assets/; worker-src 'self' blob:");
    expect(await response.text()).toBe("<html>Teste</html>");
  });
  it.each(["application/json", "application/javascript", "text/css", "image/svg+xml", "application/manifest+json", ""])("preserva resposta não HTML %s", (mime) => {
    const original = new Response("Teste", { headers: { "content-type": mime } });
    expect(protegerMetricas(new Request("https://loja.example/fiado/ficticio"), original)).toBe(original);
  });
  it("preserva status, cookies, cache, CSP anterior e corpo", async () => {
    const original = new Response("Recuperação", { status: 500, headers: { "content-type": "text/html", "set-cookie": "teste=ficticio; Secure", "cache-control": "no-store", "content-security-policy": "object-src 'none'" } });
    const response = protegerMetricas(new Request("https://loja.example/pedido/ficticio"), original);
    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBe("teste=ficticio; Secure");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toBe("object-src 'none', script-src 'unsafe-inline' 'unsafe-eval' https://loja.example/assets/; worker-src 'self' blob:");
    expect(await response.text()).toBe("Recuperação");
  });
  it("cabeçalho não contém token/query e usa o próprio domínio/porta", () => {
    const response = protegerMetricas(new Request("http://localhost:4209/fiado/token-ficticio?pin=ficticio"), html());
    expect(response.headers.get("content-security-policy")).toContain("http://localhost:4209/assets/");
    expect(response.headers.get("content-security-policy")).not.toContain("ficticio");
  });
});
