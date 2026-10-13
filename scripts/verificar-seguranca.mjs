// Verificacoes de manutencao. Nunca usa credencial ou banco de producao.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const cacheLovable = 'https://europe-west4-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/';

const padroes = [
  ['PAT Supabase', /\bsbp_[a-f0-9]{40,}\b/i],
  ['Segredo Supabase', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['PAT GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['Identificador AWS', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
];

export function tiposDeSegredo(texto) {
  const tipos = padroes.filter(([, re]) => re.test(texto)).map(([tipo]) => tipo);
  for (const jwt of texto.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      const carga = JSON.parse(Buffer.from(jwt[1], 'base64url').toString());
      // A chave anon legada e publica por desenho; RLS/ACL protegem os dados.
      if (carga.role === 'service_role') tipos.push('JWT service_role');
    } catch { /* Texto parecido com JWT nao e classificado como credencial. */ }
  }
  return [...new Set(tipos)];
}

function git(repo, args, binario = false) {
  try {
    return execFileSync('git', args, {
      cwd: repo, encoding: binario ? undefined : 'utf8',
      maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch { throw new Error('Nao foi possivel ler o Git por completo. Verificacao recusada.'); }
}

export function procurarSegredos(repo) {
  if (git(repo, ['rev-parse', '--is-shallow-repository']).trim() !== 'false') {
    throw new Error('Historico incompleto. Use fetch-depth: 0.');
  }
  const ocorrencias = [];
  // Arvore atual, inclusive durante uma validacao local antes do commit.
  for (const arquivo of git(repo, ['ls-files', '-z']).split('\0').filter(Boolean)) {
    const tipos = tiposDeSegredo(readFileSync(`${repo}/${arquivo}`, 'utf8'));
    if (tipos.length) ocorrencias.push({ arquivo, tipos });
  }
  const ids = git(repo, ['rev-list', '--objects', '--all']).split('\n')
    .filter(Boolean).map((linha) => linha.split(' ', 1)[0]);
  const objetos = git(repo, ['cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype) %(objectsize)']);
  const alcancaveis = new Set(ids);
  let blobs = 0;
  for (const linha of objetos.trim().split('\n')) {
    const [id, tipo, tamanho] = linha.split(' ');
    if (tipo !== 'blob' || !alcancaveis.has(id)) continue;
    if (!Number.isSafeInteger(Number(tamanho)) || Number(tamanho) > 16 * 1024 * 1024) {
      throw new Error('Objeto excede o limite de leitura. Exige revisao, nao foi ignorado.');
    }
    blobs++;
    const tipos = tiposDeSegredo(git(repo, ['cat-file', 'blob', id]));
    if (tipos.length) ocorrencias.push({ objeto: id, tipos });
  }
  return { blobs, ocorrencias };
}

export function pacotesDoLock(lock) {
  if (lock?.lockfileVersion !== 1 || !lock.packages || Array.isArray(lock.packages) || typeof lock.packages !== 'object') {
    throw new Error('Formato de bun.lock nao reconhecido.');
  }
  const pacotes = {};
  for (const entrada of Object.values(lock.packages)) {
    const [resolucao, registro, , integridade] = Array.isArray(entrada) ? entrada : [];
    const partes = typeof resolucao === 'string' && resolucao.match(/^((?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+)@(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)$/);
    if (!partes || (registro !== '' && !(typeof registro === 'string' && registro.startsWith(cacheLovable))) || typeof integridade !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(integridade)) {
      throw new Error('Pacote fora do formato npm com SHA512: exige revisao antes de seguir.');
    }
    const [, nome, versao] = partes;
    pacotes[nome] ??= [];
    if (!pacotes[nome].includes(versao)) pacotes[nome].push(versao);
  }
  if (!Object.keys(pacotes).length) throw new Error('Lock vazio: nenhum pacote foi verificado.');
  return pacotes;
}

// Normaliza somente a COPIA descartavel da instalacao, mantendo versoes/SHA512.
export async function lockParaCI(lock, requisitar = fetch) {
  pacotesDoLock(lock);
  const copia = structuredClone(lock);
  for (const entrada of Object.values(copia.packages)) {
    if (!entrada[1].startsWith(cacheLovable)) continue;
    const posicao = entrada[0].lastIndexOf('@');
    const nome = entrada[0].slice(0, posicao), versao = entrada[0].slice(posicao + 1);
    const resposta = await requisitar(`https://registry.npmjs.org/${encodeURIComponent(nome)}/${versao}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!resposta.ok) throw new Error('Pacote do cache Lovable: registro npm indisponivel.');
    const meta = await resposta.json();
    const url = new URL(meta?.dist?.tarball);
    if (meta.name !== nome || meta.version !== versao || meta.dist.integrity !== entrada[3] ||
        url.origin !== 'https://registry.npmjs.org' || url.username || url.password || url.search || url.hash) {
      throw new Error('Pacote do cache Lovable: origem/versao/SHA512 diferente. Instalacao recusada.');
    }
    entrada[1] = url.href;
  }
  return copia;
}

export async function consultarAvisos(pacotes, requisitar = fetch) {
  const resposta = await requisitar('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(pacotes), signal: AbortSignal.timeout(30000),
  });
  if (!resposta.ok) throw new Error(`Consulta de avisos indisponivel (HTTP ${resposta.status}).`);
  const avisos = await resposta.json();
  if (!avisos || Array.isArray(avisos) || typeof avisos !== 'object') throw new Error('Resposta de avisos invalida.');
  const encontrados = [];
  for (const [nome, lista] of Object.entries(avisos)) {
    if (!Object.hasOwn(pacotes, nome) || !Array.isArray(lista) || !lista.length) throw new Error('Resposta de avisos invalida.');
    for (const aviso of lista) {
      if (!Number.isSafeInteger(aviso.id) || !['info', 'low', 'moderate', 'high', 'critical'].includes(aviso.severity)) {
        throw new Error('Aviso sem identificacao ou gravidade valida.');
      }
      encontrados.push({ pacote: nome, id: aviso.id, gravidade: aviso.severity });
    }
  }
  return encontrados;
}

export async function executar(modo, repo = process.cwd()) {
  if (modo === 'segredos') {
    const resultado = procurarSegredos(repo);
    console.log(JSON.stringify(resultado)); // So tipos/caminhos/IDs; nunca valores encontrados.
    if (resultado.ocorrencias.length) throw new Error('Possivel segredo no codigo/historico. Exige tratamento.');
    return;
  }
  if (modo === 'preparar-instalacao') {
    if (!globalThis.Bun?.JSONC || !process.argv[3]) throw new Error('Use Bun e informe a pasta descartavel da instalacao.');
    const lock = Bun.JSONC.parse(readFileSync(`${repo}/bun.lock`, 'utf8'));
    const copia = await lockParaCI(lock);
    const destino = process.argv[3];
    mkdirSync(destino, { recursive: true });
    for (const arquivo of ['package.json', 'bunfig.toml']) copyFileSync(`${repo}/${arquivo}`, `${destino}/${arquivo}`);
    writeFileSync(`${destino}/bun.lock`, JSON.stringify(copia, null, 2));
    console.log('Copia de instalacao preparada; lock original preservado e SHA512 conferidos.');
    return;
  }
  if (modo === 'dependencias') {
    const { default: ts } = await import('typescript');
    const leitura = ts.parseConfigFileTextToJson('bun.lock', readFileSync(`${repo}/bun.lock`, 'utf8'));
    if (leitura.error) throw new Error('bun.lock nao pode ser interpretado.');
    const pacotes = pacotesDoLock(leitura.config);
    const avisos = await consultarAvisos(pacotes);
    console.log(JSON.stringify({ pacotes: Object.keys(pacotes).length, avisos }));
    if (avisos.length) throw new Error('Dependencias com aviso conhecido. Exige revisao.');
    return;
  }
  throw new Error('Use segredos, dependencias ou preparar-instalacao.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executar(process.argv[2]).catch((erro) => {
    // Erros externos podem conter texto sensivel; mostrar somente erros internos conhecidos.
    const texto = erro.message;
    const seguro = /^(Nao foi|Historico|Objeto|Formato|Pacote|Lock vazio|Consulta de avisos|Resposta de avisos|Aviso sem|Possivel segredo|Dependencias com|bun\.lock|Use )/.test(texto);
    console.error(seguro ? texto : 'Verificacao nao concluiu. Consulte o servico e repita; resultado nao aprovado.');
    process.exitCode = 1;
  });
}
