import { it, expect, vi, beforeEach } from "vitest";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc}}));
import { caixaProdutos, caixaConferirVenda, caixaRegistrarVenda, resolverConferencia } from "@/lib/banco";
import { montarVenda } from "@/lib/caixa";
const venda=montarVenda("v","t",[{id:"i",produtoId:"p",variacaoId:null,embalagemId:null,codigo:null,nome:"Bala",detalhe:"",unidade:"Unidade",fracionado:false,qtd:7,preco:399}],[{forma:"pix",valor:2793}],null);
beforeEach(()=>rpc.mockReset());
it("quantidade desconhecida permanece null e variações ficam separadas",async()=>{
 rpc.mockResolvedValue({data:[{id:"p",nome:"Bala",estoques:[{variacao_id:null,quantidade:null},{variacao_id:"azul",quantidade:0},{variacao_id:"verde",quantidade:5}]}],error:null});
 expect((await caixaProdutos("ch"))[0]?.estoques).toEqual([{variacaoId:null,quantidade:null},{variacaoId:"azul",quantidade:0},{variacaoId:"verde",quantidade:5}]);
});
it("conferir usa a função existente sem finalizar a venda",async()=>{
 rpc.mockResolvedValue({data:{situacao:"aprovada"},error:null});expect(await caixaConferirVenda("ch",venda)).toEqual({situacao:"aprovada"});
 expect(rpc).toHaveBeenCalledWith("caixa_registrar_venda",{_chave:"ch",_venda:{...venda,acao:"conferir"}});
});
it.each(["data","error"])("recusa HTTP/SQL em %s não vira venda registrada",async(campo)=>{
 rpc.mockResolvedValue({data:null,error:null,[campo]:{situacao:"bloqueada",bloqueios:[{nome:"Bala",motivo:"estoque_insuficiente",contagem_solicitada:true}]}});
 expect(await caixaRegistrarVenda("ch",venda)).toEqual({situacao:"bloqueada",bloqueios:[{nome:"Bala",motivo:"estoque_insuficiente",contagemSolicitada:true}]});
});
it("resposta desconhecida não confirma venda",async()=>{
 rpc.mockResolvedValue({data:{situacao:"aprovada"},error:null});await expect(caixaRegistrarVenda("ch",venda)).rejects.toThrow("resposta_venda_invalida");
});
it("reenvio usa número e troco confirmados pelo banco",async()=>{
 rpc.mockResolvedValue({data:{situacao:"repetida",numero:9,troco:12.07},error:null});expect(await caixaRegistrarVenda("ch",venda)).toEqual({situacao:"repetida",numero:9,troco:1207,semCadastro:0});
});
it("depósito pendente não se transforma em acerto zero falso",async()=>{
 rpc.mockResolvedValue({data:{situacao:"aguardando_deposito"},error:null});await expect(resolverConferencia("d",7)).rejects.toThrow("deposito_aguardando_contagem");
});
