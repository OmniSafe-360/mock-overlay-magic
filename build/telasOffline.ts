import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import type { Plugin } from "vite";

/** Inclui todos os chunks públicos, inclusive imports tardios do Caixa. Nenhum dado do banco. */
export function telasOffline(): Plugin {
  return {
    name: "omni-telas-offline",
    apply: "build",
    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;
      const modelo = readFileSync(new NodeURL("../public/sw-funcionario.js", import.meta.url), "utf8");
      const arquivos = Object.keys(bundle).filter((nome) => /^assets\/[^/]+\.(js|css)$/.test(nome)).sort();
      if (!arquivos.length) throw new Error("Sem arquivos do app para preparar abertura offline.");
      const versao = createHash("sha256").update(modelo).update(JSON.stringify(arquivos)).digest("hex").slice(0, 24);
      this.emitFile({ type: "asset", fileName: "sw-funcionario.js", source: modelo.replace("/*__OMNI_BUILD__*/ null", JSON.stringify({ versao, arquivos: arquivos.map((nome) => `/${nome}`) })) });
    },
  };
}
