import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { erroParaTelemetria, reportLovableError } from "@/lib/lovable-error-reporting";
const secret = "token_ficticio_exclusivo_123456";
const capture = vi.fn();
const runtime = vi.fn();
beforeEach(() => {
  capture.mockClear(); runtime.mockClear();
  window.__lovableEvents = { captureException: capture };
  window.__lovableReportRuntimeError = runtime;
});
afterEach(() => {
  delete window.__lovableEvents; delete window.__lovableReportRuntimeError;
  window.history.replaceState(null, "", "/");
});
describe("G1.4 — relatórios sem dados secretos", () => {
  it.each(["/pedido/", "/fiado/"])("não envia token da rota %s, erro ou contexto", (prefix) => {
    window.history.replaceState(null, "", prefix + secret + "?pin=1234#segredo");
    const original = new TypeError(`Falha ${secret} PIN 1234`);
    original.stack = `stack ${secret}`;
    reportLovableError(original, { token: secret, pin: "1234", route: prefix + secret, nested: { chave: secret } });
    const [error, context, options] = capture.mock.calls[0]!;
    expect(error).not.toBe(original);
    expect(error.message).toBe("Falha de execução na interface.");
    expect(error.name).toBe("TypeError");
    expect(error.stack).toBeUndefined();
    expect(context.route).toBe(prefix + ":token");
    expect(options.mechanism).toBe("react_error_boundary");
    expect(JSON.stringify([context, runtime.mock.calls])).not.toContain(secret);
    expect(runtime.mock.calls[0]![0]).not.toHaveProperty("stack");
    expect(original.message).toContain(secret);
  });
  it.each(["/", "/funcionario", "/caixa", "/conector", "/desconhecida/segredo", "/api/public/fiado-manifest.segredo"])("classifica rota %s", (path) => {
    window.history.replaceState(null, "", path);
    reportLovableError(new Error(secret));
    const expected = path.startsWith("/api/") ? "/fiado/:token" : path.startsWith("/desconhecida/") ? "[outra_rota]" : path;
    expect(capture.mock.calls[0]![1].route).toBe(expected);
    expect(runtime.mock.calls[0]![0].filename).toBe(expected);
  });
  it.each([secret, { message: secret, details: secret }, null, 123, { toJSON() { throw Error(secret); } }])("não serializa valor bruto %#", (input) => {
    reportLovableError(input);
    expect(capture.mock.calls[0]![0].message).toBe("Falha de execução na interface.");
    expect(runtime.mock.calls[0]![0].message).not.toContain(secret);
  });
  it("Response conserva status sem URL ou corpo", () => {
    const response = new Response(secret, { status: 403 });
    Object.defineProperty(response, "url", { value: "/pedido/" + secret });
    reportLovableError(response);
    expect(capture.mock.calls[0]![0].message).toBe("Resposta HTTP 403.");
    expect(runtime.mock.calls[0]![0]).toEqual({ message: "Resposta HTTP 403.", filename: "/" });
  });
  it("classe de erro arbitrária não vira dado de telemetria", () => {
    const error = new Error(secret); error.name = secret;
    expect(erroParaTelemetria(error).name).toBe("Error");
  });
  it("console da fronteira pode usar o mesmo erro seguro, sem mutar o original", () => {
    const original = new Error(secret); const safe = erroParaTelemetria(original);
    expect(safe.message).not.toContain(secret); expect(safe.stack).toBeUndefined();
    expect(original.message).toBe(secret);
  });
  it("funciona quando hooks não estão presentes", () => {
    delete window.__lovableEvents; delete window.__lovableReportRuntimeError;
    expect(() => reportLovableError(new Error(secret))).not.toThrow();
  });
  it("um hook ausente não impede chamar o outro", () => {
    delete window.__lovableEvents;
    reportLovableError(new Error(secret));
    expect(runtime).toHaveBeenCalledOnce();
  });
});
