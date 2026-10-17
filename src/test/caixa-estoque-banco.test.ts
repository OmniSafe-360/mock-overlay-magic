import { it, expect, vi, beforeEach } from "vitest";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc}}));
import { caixaProdutos, caixaConferirVenda, caixaRegistrarVenda, resolverConferencia, resolverConferenciaComMotivo } from "@/lib/banco";
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
 rpc.mockResolvedValue({data:null,error:null,[campo]:{situacao:"bloqueada",bloqueios:[{nome:"Bala",motivo:"estoque_insuficiente",contagem_solicitada:true,disponivel:5,produto_id:"p"}]}});
 expect(await caixaRegistrarVenda("ch",venda)).toEqual({situacao:"bloqueada",bloqueios:[{nome:"Bala",motivo:"estoque_insuficiente",contagemSolicitada:true,disponivel:5,produtoId:"p"}]});
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

it("F03: envia decisão e motivo no mesmo RPC",async()=>{
 rpc.mockResolvedValue({data:{diferenca:-3,valor:-6},error:null});
 expect(await resolverConferenciaComMotivo("d",17,"sumiu","ver câmeras")).toEqual({diferenca:-3});
 expect(rpc).toHaveBeenCalledWith("resolver_conferencia_com_motivo",{_diferenca:"d",_contado:17,_motivo:"sumiu",_observacao:"ver câmeras"});
});
it("F03: espera depósito sem anunciar estoque ajustado",async()=>{
 rpc.mockResolvedValue({data:{situacao:"aguardando_deposito"},error:null});
 await expect(resolverConferenciaComMotivo("d",17,"sumiu","")).rejects.toThrow("deposito_aguardando_contagem");
});
it("F03: falha e resposta incorreta não confirmam",async()=>{
 rpc.mockResolvedValueOnce({data:null,error:{message:"erro_sql"}}).mockResolvedValueOnce({data:null,error:null});
 await expect(resolverConferenciaComMotivo("d",17,"sumiu","")).rejects.toMatchObject({message:"erro_sql"});
 await expect(resolverConferenciaComMotivo("d",17,"sumiu","")).rejects.toThrow("resposta_resolucao_invalida");
});
