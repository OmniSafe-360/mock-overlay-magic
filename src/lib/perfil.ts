import { supabase } from "@/integrations/supabase/client";

export type Perfil = { nome: string; foto: string | null };
const MAX_FOTO_TEXTO = 66_000;
const FORMATOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

export function fotoDoPerfil(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor) return null;
  if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(valor) && valor.length <= MAX_FOTO_TEXTO) return valor;
  try { return new URL(valor).protocol === "https:" ? valor : null; } catch { return null; }
}

/** Uma atualização do perfil próprio; nenhum dado de login, papel ou comércio é alterado. */
export async function salvarPerfil(userId: string, perfil: Perfil): Promise<Perfil> {
  const nome = perfil.nome.trim().replace(/\s+/g, " ");
  if (!nome) throw new Error("Informe seu nome.");
  if (nome.length > 120) throw new Error("Use até 120 caracteres no nome.");
  if (perfil.foto !== null && !fotoDoPerfil(perfil.foto)) throw new Error("Escolha uma foto válida.");
  const { data: auth, error: authErro } = await supabase.auth.getUser();
  if (authErro) throw authErro;
  if (!userId || auth.user?.id !== userId) throw new Error("Sua sessão mudou. Entre novamente para editar o perfil.");
  const { data, error } = await supabase.from("profiles").update({ nome, avatar_url: perfil.foto })
    .eq("id", userId).select("nome,avatar_url").single();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível confirmar a alteração do perfil. Tente novamente.");
  return { nome: data.nome ?? nome, foto: fotoDoPerfil(data.avatar_url) };
}

export function erroPerfil(erro: unknown): string {
  const e = erro as { message?: string; status?: number; code?: string };
  const msg = e?.message ?? "";
  if ((typeof navigator !== "undefined" && !navigator.onLine) || /fetch|network|load failed/i.test(msg))
    return "A conexão falhou. Confira a internet e tente salvar novamente.";
  if (e?.status === 401 || /jwt|session|refresh token/i.test(msg)) return "Sua sessão expirou. Entre novamente para editar o perfil.";
  if (/^(Informe seu nome|Use até|Escolha uma foto|Sua sessão mudou|Não foi possível confirmar)/.test(msg)) return msg;
  return "Não foi possível salvar o perfil. Seus dados continuam preenchidos. Tente novamente.";
}

/** Reduz a foto e remove os metadados antes de guardar uma imagem pequena no perfil existente. */
export async function prepararFoto(arquivo: File): Promise<string> {
  if (!FORMATOS_FOTO.includes(arquivo.type)) throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  if (!arquivo.size || arquivo.size > 8 * 1024 * 1024) throw new Error("Escolha uma foto de até 8 MB.");
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Não foi possível abrir esta foto. Escolha outra imagem."));
      img.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("Não foi possível abrir esta foto. Escolha outra imagem.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a foto neste navegador.");
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 256, 256);
    for (const qualidade of [0.85, 0.7, 0.55, 0.4]) {
      const foto = canvas.toDataURL("image/jpeg", qualidade);
      if (fotoDoPerfil(foto)) return foto;
    }
    throw new Error("Esta foto ficou muito grande. Escolha outra imagem.");
  } finally { URL.revokeObjectURL(url); }
}
