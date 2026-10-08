# Instruções para o Claude — Omni Safe 360

**Antes de qualquer ação, leia `docs/FONTE_DA_VERDADE.md`** (seções 1 e 2 primeiro) e confira cada decisão contra ela. Se algo contradisser o documento, vale o documento, a não ser que o dono diga o contrário por escrito.

## Como trabalhar (combinado com o dono)

- O dono não é programador: fale em português simples, sem jargão.
- Mudanças no front-end: **não alterar o código direto.** Entregar **um prompt por vez** para o dono colar no Lovable, sempre com a seção "PROTEÇÃO DO CORE". Nunca enviar nada ao Lovable pela ferramenta.
- Depois que o dono aplicar o prompt, **analisar o que o Lovable mudou** (GitHub e banco), comparar com a fonte da verdade e entregar um roteiro de teste.
- Nunca avançar de etapa sem o dono testar e informar o resultado.
- Banco (Supabase `omnisafe-360-oficial`, ref `bvwjprxfthhreuhovgbk`): só aplicar mudanças com o desenho aprovado pelo dono; RLS sempre ligada.
- Git: nunca reescrever histórico publicado (sem force push, rebase ou squash).

## Decisões registradas depois da versão 1.0 do documento

- 08/10/2026: o dono decidiu **manter o repositório GitHub público** (contraria a seção 10, por decisão escrita do dono).
- 08/10/2026: o Claude agora tem acesso ao GitHub, ao Lovable e ao Supabase, mas a regra 3 continua: o dono é quem cola os prompts no Lovable.
- Busca de CEP usa ViaCEP e, como reserva, BrasilAPI (seção 8 cita só ViaCEP).
