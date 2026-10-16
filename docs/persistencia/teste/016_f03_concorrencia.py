"""F03: duas conexões reais sobre a mesma diferença, no banco DESCARTÁVEL."""
import concurrent.futures
import hashlib
import subprocess
import threading

def uid(tag):
    x = hashlib.md5(("cega-20261012-" + tag).encode()).hexdigest()
    return "'" + x[:8] + "-" + x[8:12] + "-" + x[12:16] + "-" + x[16:20] + "-" + x[20:] + "'::uuid"

def run(query, check=True):
    r = subprocess.run(["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", query],
                       capture_output=True, text=True, timeout=20)
    if check and r.returncode:
        raise AssertionError(r.stderr)
    return r

dif, cf, prod = uid("f03-concorre"), uid("f03-concorre-cf"), uid("tres")
run(f"""insert into conferencias(id,comercio_id,produto_id,area,funcionario_id,situacao,esperado,contado,tentativas)
values({cf},{uid('com')},{prod},'deposito',{uid('func')},'inconsistente',0,2,'[1,2,3]'::jsonb);
insert into diferencas(id,comercio_id,produto_id,area,origem,esperado,contado,diferenca,valor,funcionario_id,referencia_id,detalhes)
values({dif},{uid('com')},{prod},'deposito','conferencia_inconsistente',0,2,2,4,{uid('func')},{cf},
jsonb_build_object('tentativas',jsonb_build_array(1,2,3)));""")
gate = threading.Barrier(2)

def decide(_):
    gate.wait()
    return run(f"""begin;
select set_config('request.jwt.claim.sub',{uid('dono')}::text,true);
set local role authenticated;
select resolver_conferencia_com_motivo({dif},2,'sumiu','recontado');
commit;""", False)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    answers = list(pool.map(decide, range(2)))
assert sum(r.returncode == 0 for r in answers) == 1, [(r.returncode,r.stderr[-400:]) for r in answers]
assert sum("contagem_ja_resolvida" in r.stderr for r in answers) == 1, [(r.returncode,r.stderr[-400:]) for r in answers]
assert all("deadlock" not in r.stderr for r in answers)
r = run(f"""select saldo_chave({prod},null,'deposito')=2
and (select count(*)=1 from operacoes where hash=md5({dif}::text||':resolver'))
and (select situacao='explicada' and motivo='sumiu' from diferencas where id={dif})""")
assert r.stdout.strip() == "t", r.stdout
print("OK F03: duas decisões simultâneas, uma só baixa e uma justificativa.")
