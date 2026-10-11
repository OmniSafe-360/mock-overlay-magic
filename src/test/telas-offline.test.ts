import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { URL as NodeURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { telasOffline } from "../../build/telasOffline";

const modelo = readFileSync(new NodeURL("../../public/sw-funcionario.js", import.meta.url), "utf8");
const origem = "https://omni.test";
const build = { versao: "nova", arquivos: ["/assets/app-abc.js", "/assets/tardio-def.js", "/assets/style-ghi.css"] };
const html = '<html><link href="/assets/style-ghi.css"><script src="/assets/app-abc.js"></script></html>';
const prefixo = (rota: string) => `omni-telas-v1:${rota}:`;
const absoluto = (pedido: Request | string) => typeof pedido === "string" ? new URL(pedido, origem).href : pedido.url;

function trabalhador(rota = "/caixa", configuracao: typeof build | null = build) {
  const listeners: Record<string, (e: any) => void> = {};
  const mapas = new Map<string, Map<string, Response>>();
  const rede = vi.fn(async (pedido: Request) => new Response(pedido.url.endsWith(rota) ? html : "arquivo", { headers: { "content-type": pedido.url.endsWith(rota) ? "text/html" : "text/javascript" } }));
  const caches = {
    keys: vi.fn(async () => [...mapas.keys()]),
    delete: vi.fn(async (nome: string) => mapas.delete(nome)),
    open: vi.fn(async (nome: string) => {
      if (!mapas.has(nome)) mapas.set(nome, new Map());
      const mapa = mapas.get(nome)!;
      return {
        match: vi.fn(async (pedido: Request | string) => mapa.get(absoluto(pedido))?.clone()),
        put: vi.fn(async (pedido: Request | string, res: Response) => { mapa.set(absoluto(pedido), res.clone()); }),
        addAll: vi.fn(async (pedidos: Request[]) => {
          const respostas = await Promise.all(pedidos.map((p) => rede(p)));
          if (respostas.some((r) => !r.ok)) throw new Error("cache incompleto");
          pedidos.forEach((p, i) => mapa.set(p.url, respostas[i]!.clone()));
        }),
      };
    }),
  };
  const claim = vi.fn(async () => {}), skipWaiting = vi.fn();
  class Pedido extends Request { constructor(url: string | Request, init?: RequestInit) { super(typeof url === "string" ? new URL(url, origem) : url, init); } }
  runInNewContext(modelo.replace("/*__OMNI_BUILD__*/ null", JSON.stringify(configuracao)), {
    self: { registration: { scope: origem + rota }, location: { origin: origem }, clients: { claim }, skipWaiting, addEventListener: (tipo: string, fn: any) => { listeners[tipo] = fn; } },
    caches, Request: Pedido, Response, URL, fetch: rede,
  });
  async function executar(tipo: string) { let tarefa: Promise<void> | undefined; listeners[tipo]!({ waitUntil: (p: Promise<void>) => { tarefa = p; } }); await tarefa; }
  function buscar(url: string, mode = "navigate", method = "GET") {
    let resposta: Promise<Response> | undefined;
    listeners["fetch"]!({ request: { url: new URL(url, origem).href, mode, method }, respondWith: (p: Promise<Response>) => { resposta = p; } });
    return resposta;
  }
  return { mapas, rede, caches, claim, skipWaiting, executar, buscar };
}

describe("arquivos para reabrir Caixa/Operação sem internet", () => {
  it.each(["/caixa", "/funcionario"])("guarda tela limpa e todos os chunks em %s, sem cookies e sem trocar app aberto", async (rota) => {
    const t = trabalhador(rota);
    await t.executar("install");
    expect(t.skipWaiting).not.toHaveBeenCalled();
    const mapa = t.mapas.get(prefixo(rota) + "nova")!;
    expect([...mapa.keys()]).toEqual([...build.arquivos.map((p) => origem + p), origem + rota]);
    for (const [req] of t.rede.mock.calls) { expect(req.credentials).toBe("omit"); expect(req.cache).toBe("reload"); }
    t.rede.mockRejectedValue(new Error("offline"));
    expect(await (await t.buscar(rota))!.text()).toBe(html);
    expect(await (await t.buscar(rota + "/"))!.text()).toBe(html);
    expect(await (await t.buscar("/assets/tardio-def.js", "cors"))!.text()).toBe("arquivo");
    expect(t.rede).toHaveBeenCalledTimes(4);
  });
  it.each(["rede", "arquivo", "espaco"])("instalação com falha de %s não deixa versão parcial nem remove a anterior", async (falha) => {
    const t = trabalhador(); t.mapas.set(prefixo("/caixa") + "antiga", new Map());
    if (falha === "rede") t.rede.mockRejectedValue(new Error("offline"));
    if (falha === "arquivo") t.rede.mockImplementation(async (p) => p.url.endsWith("def.js") ? new Response("ausente", { status: 404 }) : new Response(p.url.endsWith("/caixa") ? html : "arquivo", { headers: { "content-type": "text/html" } }));
    if (falha === "espaco") t.caches.open.mockRejectedValue(new Error("QuotaExceeded"));
    await expect(t.executar("install")).rejects.toThrow();
    expect(t.mapas.has(prefixo("/caixa") + "antiga")).toBe(true);
    expect(t.mapas.has(prefixo("/caixa") + "nova")).toBe(false);
    expect(t.claim).not.toHaveBeenCalled();
  });
  it.each(["<html>sem arquivos</html>", '<script src="/assets/outra-versao.js"></script>'])("recusa HTML sem arquivos compatíveis: %s", async (texto) => {
    const t = trabalhador(); t.rede.mockResolvedValue(new Response(texto, { headers: { "content-type": "text/html" } }));
    await expect(t.executar("install")).rejects.toThrow("versões diferentes");
    expect(t.caches.open).not.toHaveBeenCalled();
  });
  it.each([new Response("erro", { status: 500 }), new Response("ok", { headers: { "content-type": "application/json" } })])("recusa resposta de tela inválida", async (res) => {
    const t = trabalhador(); t.rede.mockResolvedValue(res);
    await expect(t.executar("install")).rejects.toThrow("indisponível");
  });
  it("ativação limpa só versões antigas do mesmo app", async () => {
    const t = trabalhador();
    for (const nome of [prefixo("/caixa") + "antiga", prefixo("/caixa") + "nova", prefixo("/funcionario") + "antiga", "outro-app"]) t.mapas.set(nome, new Map());
    await t.executar("activate");
    expect(t.caches.delete).toHaveBeenCalledExactlyOnceWith(prefixo("/caixa") + "antiga");
    expect(t.claim).toHaveBeenCalledTimes(1);
  });
  it("falha ao gravar HTML descarta só a versão nova; acesso/fila não são tocados", async () => {
    const t = trabalhador();
    t.mapas.set(prefixo("/caixa") + "antiga", new Map());
    const abrir = t.caches.open.getMockImplementation()!;
    t.caches.open.mockImplementation(async (nome) => ({ ...(await abrir(nome)), put: vi.fn(async () => { throw new Error("sem espaço"); }) }));
    await expect(t.executar("install")).rejects.toThrow("sem espaço");
    expect(t.caches.delete).toHaveBeenCalledExactlyOnceWith(prefixo("/caixa") + "nova");
    expect(t.mapas.has(prefixo("/caixa") + "antiga")).toBe(true);
  });
  it.each([
    ["https://banco.supabase.co/rest/v1/rpc/caixa_estado", "cors", "GET"],
    ["/api/dados", "cors", "GET"], ["/", "navigate", "GET"], ["/comercio/privado", "navigate", "GET"],
    ["/caixa", "navigate", "POST"], ["/caixa/dados", "cors", "GET"], ["/assets/app-abc.js?token=secreto", "cors", "GET"],
    ["/assets/desconhecido.js", "cors", "GET"], ["/funcionario", "navigate", "GET"], ["/caixa", "cors", "GET"],
  ])("não intercepta nem guarda %s (%s/%s)", (url, mode, method) => {
    const t = trabalhador(); expect(t.buscar(url, mode, method)).toBeUndefined(); expect(t.caches.open).not.toHaveBeenCalled(); expect(t.rede).not.toHaveBeenCalled();
  });
  it("convite é consultado online sem guardar HTML/parâmetros; offline usa só a tela limpa", async () => {
    const t = trabalhador(); await t.executar("install");
    const mapa = t.mapas.get(prefixo("/caixa") + "nova")!;
    t.rede.mockResolvedValue(new Response("convite online"));
    expect(await (await t.buscar("/caixa?codigo=123456"))!.text()).toBe("convite online");
    t.rede.mockRejectedValue(new Error("offline"));
    expect(await (await t.buscar("/caixa?codigo=123456"))!.text()).toBe(html);
    expect([...mapa.keys()].some((url) => url.includes("codigo"))).toBe(false);
    expect(await mapa.get(origem + "/caixa")!.clone().text()).toBe(html);
  });
  it.each([["/caixa", null], ["/", build]])("não prepara cache fora do build/escopo permitido", async (rota, configuracao) => {
    const t = trabalhador(rota as string, configuracao as typeof build | null);
    await t.executar("install"); await t.executar("activate"); expect(t.buscar("/caixa")).toBeUndefined(); expect(t.rede).not.toHaveBeenCalled();
  });
});

describe("build das telas offline", () => {
  it("gera worker só no cliente, incluindo chunks tardios e CSS, sem mapas/server", () => {
    const plugin = telasOffline(); const emitFile = vi.fn();
    const hook = plugin.generateBundle as Function;
    const bundle = { "assets/app-abc.js": {}, "assets/tardio-def.js": {}, "assets/style-ghi.css": {}, "assets/app-abc.js.map": {}, "server.mjs": {} };
    hook.call({ environment: { name: "ssr" }, emitFile }, {}, bundle); expect(emitFile).not.toHaveBeenCalled();
    hook.call({ environment: { name: "client" }, emitFile }, {}, bundle);
    const source = emitFile.mock.calls[0]![0].source;
    expect(source).toContain('"/assets/tardio-def.js"'); expect(source).toContain('"/assets/style-ghi.css"'); expect(source).not.toContain('"/server.mjs"'); expect(source).not.toContain('"/assets/app-abc.js.map"'); expect(source).not.toContain("/*__OMNI_BUILD__*/ null");
    hook.call({ environment: { name: "client" }, emitFile }, {}, { ...bundle, "assets/novo-xyz.js": {} });
    expect(emitFile.mock.calls[1]![0].source).not.toBe(source);
  });
});
