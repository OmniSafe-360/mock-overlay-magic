import { useEffect, useRef, useState } from "react";
import { Camera, Pencil, UserCircle } from "lucide-react";
import { erroPerfil, fotoDoPerfil, prepararFoto, salvarPerfil, type Perfil } from "@/lib/perfil";
import { btnGhost, btnPrimary } from "@/components/StoreSetup";

const API_PERFIL = { salvar: salvarPerfil, prepararFoto };
type ApiPerfil = typeof API_PERFIL;

function Foto({ foto }: { foto: string | null }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [foto]);
  return (
    <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background-deep/60">
      {foto && !falhou ? <img src={foto} alt="Foto de perfil" className="h-full w-full object-cover" onError={() => setFalhou(true)} /> : <UserCircle size={48} className="text-primary" aria-hidden />}
    </span>
  );
}

export function ContaPerfil({ userId, nome, foto, email, onSalvo, onLogout, api = API_PERFIL }: {
  userId: string; nome: string; foto: string | null; email: string;
  onSalvo: (perfil: Perfil) => void; onLogout?: (() => void) | undefined; api?: ApiPerfil;
}) {
  const [editando, setEditando] = useState(false);
  const [nomeEd, setNomeEd] = useState(nome);
  const [fotoEd, setFotoEd] = useState(fotoDoPerfil(foto));
  const [preparando, setPreparando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const inputFoto = useRef<HTMLInputElement>(null);
  const versaoFoto = useRef(0);
  const envio = useRef(false);
  const ativo = useRef(true);
  useEffect(() => { ativo.current = true; return () => { ativo.current = false; }; }, []);
  const editar = () => { setNomeEd(nome); setFotoEd(fotoDoPerfil(foto)); setErro(""); setAviso(""); setEditando(true); };
  const cancelar = () => { versaoFoto.current++; setPreparando(false); setErro(""); setEditando(false); };
  const escolher = async (arquivo: File) => {
    const versao = ++versaoFoto.current;
    setPreparando(true); setErro("");
    try {
      const nova = await api.prepararFoto(arquivo);
      if (ativo.current && versaoFoto.current === versao) setFotoEd(nova);
    } catch (e) {
      if (ativo.current && versaoFoto.current === versao) setErro(e instanceof Error ? e.message : "Não foi possível abrir a foto. Escolha outra imagem.");
    } finally { if (ativo.current && versaoFoto.current === versao) setPreparando(false); }
  };
  const salvar = async () => {
    if (envio.current || preparando) return;
    if (!nomeEd.trim()) { setErro("Informe seu nome."); return; }
    envio.current = true; setSalvando(true); setErro("");
    try {
      const perfil = await api.salvar(userId, { nome: nomeEd, foto: fotoEd });
      onSalvo(perfil);
      if (ativo.current) { setEditando(false); setAviso("Perfil atualizado!"); }
    } catch (e) { if (ativo.current) setErro(erroPerfil(e)); }
    finally { envio.current = false; if (ativo.current) setSalvando(false); }
  };
  return (
    <div className="mx-auto max-w-md space-y-4 animate-in fade-in duration-300">
      <section className="min-w-0 rounded-3xl border border-border bg-secondary/70 p-5" aria-label="Seu perfil">
        {editando ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
            <h1 className="text-lg font-bold">Editar perfil</h1>
            <div className="flex flex-wrap items-center gap-4">
              <Foto foto={fotoEd} />
              <div className="min-w-0 space-y-1">
                <button type="button" disabled={salvando} onClick={() => inputFoto.current?.click()} className="flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"><Camera size={18} />{fotoEd ? "Alterar foto" : "Adicionar foto"}</button>
                {fotoEd && <button type="button" disabled={salvando} onClick={() => { versaoFoto.current++; setPreparando(false); setFotoEd(null); setErro(""); }} className="min-h-12 rounded-xl px-2 text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">Remover foto</button>}
              </div>
            </div>
            <input ref={inputFoto} aria-label="Selecionar foto de perfil" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={salvando} onChange={(e) => { const arquivo = e.target.files?.[0]; e.target.value = ""; if (arquivo) void escolher(arquivo); }} />
            <p className="text-xs text-muted-foreground">Escolha uma foto JPG, PNG ou WebP de até 8 MB.</p>
            {preparando && <p role="status" className="text-sm text-muted-foreground">Preparando foto…</p>}
            <div className="space-y-1.5">
              <label htmlFor="perfil-nome" className="text-sm font-medium text-muted-foreground">Nome</label>
              <input id="perfil-nome" autoComplete="name" maxLength={120} value={nomeEd} disabled={salvando} onChange={(e) => { setNomeEd(e.target.value); setErro(""); }} className="h-13 w-full rounded-2xl border border-border bg-background-deep/60 px-4 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60" />
            </div>
            <p className="break-all text-sm text-muted-foreground">{email}</p>
            {erro && <p role="alert" className="text-sm font-semibold text-destructive">{erro}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={salvando || preparando} className={`flex-1 ${btnPrimary(!salvando && !preparando)}`}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
              <button type="button" disabled={salvando} onClick={cancelar} className={btnGhost}>Cancelar</button>
            </div>
          </form>
        ) : (
          <>
            <Foto foto={fotoDoPerfil(foto)} />
            <p className="mt-3 break-words text-lg font-bold">{nome || "Sua conta"}</p>
            <p className="mt-1 break-all text-sm text-muted-foreground">{email}</p>
            <button type="button" onClick={editar} className={`mt-4 flex w-full items-center justify-center gap-2 ${btnGhost}`}><Pencil size={18} />Editar perfil</button>
            {aviso && <p role="status" className="mt-3 text-sm font-semibold text-accent">{aviso}</p>}
          </>
        )}
      </section>
      <button type="button" onClick={onLogout} disabled={salvando} className="h-12 w-full rounded-2xl border border-destructive/50 text-sm font-semibold text-destructive transition hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">Sair</button>
    </div>
  );
}
