import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { tiposDeSegredo, procurarSegredos, pacotesDoLock, consultarAvisos, lockParaCI } from './verificar-seguranca.mjs';

const falsoPat = ['sbp_', 'a'.repeat(40)].join('');
const jwt = (role) => [Buffer.from('{}').toString('base64url'), Buffer.from(JSON.stringify({role})).toString('base64url'), 'assinatura'].join('.');
const jwtSupabase = (role) => ['eyJhbGciOiJIUzI1NiJ9', jwt(role).split('.')[1], 'assinatura'].join('.');
const integridade = 'sha512-' + Buffer.alloc(64, 1).toString('base64');
const lock = { lockfileVersion: 1, packages: { exemplo: ['exemplo@1.2.3', '', {}, integridade] } };

test('recusa PAT e chave privada, permite chave publica anon', () => {
  assert.deepEqual(tiposDeSegredo(falsoPat), ['PAT Supabase']);
  assert.deepEqual(tiposDeSegredo(['-----BEGIN ', 'PRIVATE KEY-----'].join('')), ['Chave privada']);
  assert.deepEqual(tiposDeSegredo(jwtSupabase('service_role')), ['JWT service_role']);
  assert.deepEqual(tiposDeSegredo(jwtSupabase('anon')), []);
  assert.deepEqual(tiposDeSegredo('sb_publishable_ci_sem_acesso'), []);
});

test('encontra segredo removido no historico sem vazar o valor na resposta', () => {
  const repo = mkdtempSync(join(tmpdir(), 'omni-scan-teste-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  try {
    git('init', '-q'); git('config', 'user.email', 'teste@example.invalid'); git('config', 'user.name', 'Teste local');
    writeFileSync(join(repo, 'exemplo.txt'), falsoPat); git('add', '.'); git('commit', '-qm', 'Fixture sintetica');
    writeFileSync(join(repo, 'exemplo.txt'), 'sem segredo'); git('add', '.'); git('commit', '-qm', 'Removido');
    const resultado = procurarSegredos(repo);
    assert.equal(resultado.ocorrencias.length, 1);
    assert.ok(resultado.ocorrencias[0].objeto);
    assert.equal(JSON.stringify(resultado).includes(falsoPat), false);
    const cli = spawnSync(process.execPath, [new URL('./verificar-seguranca.mjs', import.meta.url).pathname, 'segredos'], { cwd: repo, encoding: 'utf8' });
    assert.equal(cli.status, 1);
    assert.equal((cli.stdout + cli.stderr).includes(falsoPat), false);
    writeFileSync(join(repo, 'exemplo.txt'), falsoPat);
    assert.ok(procurarSegredos(repo).ocorrencias.some((item) => item.arquivo === 'exemplo.txt'));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('nao aceita lock vazio, dependencia Git ou pacote sem integridade', () => {
  assert.deepEqual(pacotesDoLock(lock), { exemplo: ['1.2.3'] });
  assert.throws(() => pacotesDoLock({ lockfileVersion: 2, packages: {} }));
  assert.throws(() => pacotesDoLock({ lockfileVersion: 1, packages: {} }));
  for (const entrada of [['git://exemplo', '', {}, integridade], ['exemplo@1.2.3', '', {}]]) {
    assert.throws(() => pacotesDoLock({ lockfileVersion: 1, packages: { exemplo: entrada } }));
  }
});

test('consulta HTTPS so envia nomes/versoes e classifica aviso conhecido', async () => {
  const pacotes = pacotesDoLock(lock);
  const resultado = await consultarAvisos(pacotes, async (url, opcoes) => {
    assert.equal(url, 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk');
    assert.deepEqual(JSON.parse(opcoes.body), pacotes);
    assert.deepEqual(opcoes.headers, { 'content-type': 'application/json' });
    return { ok: true, json: async () => ({ exemplo: [{ id: 123, severity: 'high' }] }) };
  });
  assert.deepEqual(resultado, [{ pacote: 'exemplo', id: 123, gravidade: 'high' }]);
  assert.deepEqual(await consultarAvisos(pacotes, async () => ({ ok: true, json: async () => ({}) })), []);
});

test('falha de rede ou resposta invalida nunca vira aprovacao', async () => {
  const pacotes = pacotesDoLock(lock);
  await assert.rejects(consultarAvisos(pacotes, async () => { throw new Error('falha de rede'); }));
  await assert.rejects(consultarAvisos(pacotes, async () => ({ ok: false, status: 503 })));
  for (const resposta of [null, [], { estranho: [] }, { exemplo: [{ id: 123, severity: 'desconhecida' }] }]) {
    await assert.rejects(consultarAvisos(pacotes, async () => ({ ok: true, json: async () => resposta })));
  }
});


test('cache Lovable so muda na copia se nome, versao, SHA512 e origem baterem', async () => {
  const original = structuredClone(lock);
  original.packages.exemplo[1] = 'https://europe-west4-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/exemplo/-/exemplo-1.2.3.tgz';
  const meta = { name: 'exemplo', version: '1.2.3', dist: { integrity: integridade, tarball: 'https://registry.npmjs.org/exemplo/-/exemplo-1.2.3.tgz' } };
  const responder = (valor) => async () => ({ ok: true, json: async () => valor });
  const copia = await lockParaCI(original, responder(meta));
  assert.equal(copia.packages.exemplo[1], meta.dist.tarball);
  assert.match(original.packages.exemplo[1], /npm\.pkg\.dev/);
  assert.equal(copia.packages.exemplo[3], original.packages.exemplo[3]);
  for (const errado of [
    {...meta, version: '1.2.4'},
    {...meta, dist: {...meta.dist, integrity: 'sha512-outra'}},
    {...meta, dist: {...meta.dist, tarball: 'https://outro.invalid/pacote.tgz'}},
  ]) await assert.rejects(lockParaCI(original, responder(errado)));
  await assert.rejects(lockParaCI(original, async () => ({ ok: false })));
});
