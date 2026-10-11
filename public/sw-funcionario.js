/* Telas públicas do Omni Operação/Caixa. O build insere os arquivos da mesma versão.
 * Não guarda APIs, dados, chaves, PIN, páginas do dono ou HTML com parâmetros.
 * Uma atualização espera o app fechar: não troca arquivos no meio de uma venda. */
const BUILD = /*__OMNI_BUILD__*/ null;
const rota = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const permitido = rota === "/caixa" || rota === "/funcionario";
const prefixo = `omni-telas-v1:${rota}:`;
const nomeCache = prefixo + (BUILD?.versao ?? "sem-build");
const arquivos = new Set(BUILD?.arquivos ?? []);

self.addEventListener("install", (evento) => {
  if (!BUILD || !permitido) return;
  evento.waitUntil((async () => {
    // Só a tela limpa, sem código de convite ou sessão; o PIN continua sendo exigido pelo app.
    const tela = await fetch(new Request(rota, { cache: "reload", credentials: "omit" }));
    if (!tela.ok || tela.redirected || !tela.headers.get("content-type")?.includes("text/html")) throw new Error("Tela offline indisponível.");
    const html = await tela.clone().text();
    const usados = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((m) => m[1]);
    if (!usados.length || usados.some((url) => !arquivos.has(url))) throw new Error("A tela e os arquivos são de versões diferentes.");
    const cache = await caches.open(nomeCache);
    try {
      // addAll é atômico: falta de rede/espaço/arquivo impede ativar uma versão incompleta.
      await cache.addAll([...arquivos].map((url) => new Request(url, { cache: "reload", credentials: "omit" })));
      await cache.put(rota, tela);
    } catch (erro) {
      await caches.delete(nomeCache);
      throw erro;
    }
  })());
});

self.addEventListener("activate", (evento) => {
  if (!BUILD || !permitido) return;
  evento.waitUntil((async () => {
    // Não apaga cache do outro app, armazenamento local nem vendas pendentes.
    for (const nome of await caches.keys()) if (nome.startsWith(prefixo) && nome !== nomeCache) await caches.delete(nome);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (evento) => {
  if (!BUILD || !permitido) return;
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (pedido.method !== "GET" || url.origin !== self.location.origin) return;
  const tela = pedido.mode === "navigate" && (url.pathname === rota || url.pathname === `${rota}/`);
  const arquivo = !url.search && arquivos.has(url.pathname);
  if (!tela && !arquivo) return;
  evento.respondWith((async () => {
    const cache = await caches.open(nomeCache);
    // Convites/links funcionam online e nunca ficam no CacheStorage.
    if (tela && url.search) {
      try { return await fetch(pedido); } catch { return (await cache.match(rota)) ?? Response.error(); }
    }
    return (await cache.match(tela ? rota : url.pathname)) ?? fetch(pedido);
  })());
});
