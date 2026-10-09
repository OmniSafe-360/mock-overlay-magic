/* Omni Operação: necessário para o celular oferecer "Instalar o app". Não guarda nada em cache:
   tudo continua vindo da internet, sempre a versão mais nova. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
