import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { ContaPerfil } from "@/components/ContaPerfil";
import { fotoDoPerfil, prepararFoto, salvarPerfil, type Perfil } from "@/lib/perfil";

const banco = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: banco.getUser }, from: banco.from } }));
const FOTO = "data:image/jpeg;base64,/9j/2Q==";
beforeEach(() => {
  vi.clearAllMocks();
  banco.getUser.mockResolvedValue({ data: { user: { id: "dono-a" } }, error: null });
  banco.from.mockReturnValue({ update: banco.update });
  banco.update.mockReturnValue({ eq: banco.eq });
  banco.eq.mockReturnValue({ select: banco.select });
  banco.select.mockReturnValue({ single: banco.single });
  banco.single.mockResolvedValue({ data: { nome: "Monica Silva", avatar_url: FOTO }, error: null });
});

describe("gravação do perfil próprio", () => {
  it("grava nome e foto juntos, somente no usuário autenticado, e usa a confirmação do banco", async () => {
    expect(await salvarPerfil("dono-a", { nome: "  Monica   Silva  ", foto: FOTO })).toEqual({ nome: "Monica Silva", foto: FOTO });
    expect(banco.from).toHaveBeenCalledWith("profiles");
    expect(banco.update).toHaveBeenCalledWith({ nome: "Monica Silva", avatar_url: FOTO });
    expect(banco.eq).toHaveBeenCalledWith("id", "dono-a");
    expect(banco.select).toHaveBeenCalledWith("nome,avatar_url");
  });
  it("sessão de outra pessoa não envia a alteração", async () => {
    await expect(salvarPerfil("dono-b", { nome: "Monica", foto: null })).rejects.toThrow(/sessão mudou/);
    expect(banco.from).not.toHaveBeenCalled();
  });
  it("ausência de registro confirmado não vira sucesso", async () => {
    banco.single.mockResolvedValue({ data: null, error: { code: "PGRST116", message: "Zero rows" } });
    await expect(salvarPerfil("dono-a", { nome: "Monica", foto: null })).rejects.toMatchObject({ code: "PGRST116" });
  });
  it("não aceita nome vazio ou imagem executável e não modifica o banco", async () => {
    await expect(salvarPerfil("dono-a", { nome: "  ", foto: null })).rejects.toThrow(/Informe seu nome/);
    await expect(salvarPerfil("dono-a", { nome: "Monica", foto: "javascript:alert(1)" })).rejects.toThrow(/foto válida/);
    expect(banco.update).not.toHaveBeenCalled();
  });
});

describe("foto pequena e segura", () => {
  it("aceita a foto do perfil e URL HTTPS; recusa SVG, protocolos impróprios e imagem excessiva", () => {
    expect(fotoDoPerfil(FOTO)).toBe(FOTO);
    expect(fotoDoPerfil("https://exemplo.com/avatar.jpg")).toBe("https://exemplo.com/avatar.jpg");
    for (const v of [null, "javascript:alert(1)", "data:image/svg+xml;base64,AAAA", "data:image/jpeg;base64," + "A".repeat(66_001)]) expect(fotoDoPerfil(v)).toBeNull();
  });
  it("arquivo incompatível ou grande é recusado antes do processamento", async () => {
    await expect(prepararFoto(new File(["svg"], "foto.svg", { type: "image/svg+xml" }))).rejects.toThrow(/JPG, PNG ou WebP/);
    await expect(prepararFoto(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow(/até 8 MB/);
  });
});

function abrir(api?: Parameters<typeof ContaPerfil>[0]["api"], inicial: Perfil = { nome: "Monica", foto: null }) {
  const salvar = api?.salvar ?? vi.fn(async (_id: string, p: Perfil) => ({ ...p, nome: p.nome.trim() }));
  const foto = api?.prepararFoto ?? vi.fn(async () => FOTO);
  function Conta() {
    const [perfil, setPerfil] = useState(inicial);
    return <><p>Olá, {perfil.nome.split(" ")[0]}</p><ContaPerfil userId="dono-a" nome={perfil.nome} foto={perfil.foto} email="conta@exemplo.com" onSalvo={setPerfil} api={{ salvar, prepararFoto: foto }} /></>;
  }
  const r = render(<Conta />);
  fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));
  return { ...r, salvar, foto, enviar: () => fireEvent.submit(screen.getByLabelText("Nome").closest("form")!) };
}

describe("edição na tela Conta", () => {
  it("altera nome e foto, atualiza a saudação e mostra o perfil confirmado", async () => {
    const t = abrir();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria Souza" } });
    fireEvent.change(screen.getByLabelText("Selecionar foto de perfil"), { target: { files: [new File(["foto"], "foto.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled());
    t.enviar();
    await screen.findByText("Perfil atualizado!");
    expect(t.salvar).toHaveBeenCalledWith("dono-a", { nome: "Maria Souza", foto: FOTO });
    expect(screen.getByText("Olá, Maria")).toBeTruthy();
    expect(screen.getByAltText("Foto de perfil")).toHaveAttribute("src", FOTO);
  });
  it("remoção da foto é explícita e gravada com null", async () => {
    const t = abrir(undefined, { nome: "Monica", foto: FOTO });
    fireEvent.click(screen.getByRole("button", { name: "Remover foto" }));
    t.enviar(); await screen.findByText("Perfil atualizado!");
    expect(t.salvar).toHaveBeenCalledWith("dono-a", { nome: "Monica", foto: null });
    expect(screen.queryByAltText("Foto de perfil")).toBeNull();
  });
  it("falha de conexão mantém o nome e a foto para tentar novamente", async () => {
    const salvar = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({ nome: "Maria", foto: FOTO });
    const t = abrir({ salvar, prepararFoto: vi.fn(async () => FOTO) }, { nome: "Monica", foto: FOTO });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria" } });
    t.enviar();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Confira a internet/);
    expect(screen.getByLabelText("Nome")).toHaveValue("Maria");
    expect(screen.getByAltText("Foto de perfil")).toHaveAttribute("src", FOTO);
    expect(screen.queryByText("Perfil atualizado!")).toBeNull();
    t.enviar(); await screen.findByText("Perfil atualizado!");
    expect(salvar).toHaveBeenCalledTimes(2);
  });
  it("dois envios enquanto salva fazem uma única atualização", async () => {
    let terminar!: (p: Perfil) => void;
    const salvar = vi.fn(() => new Promise<Perfil>((r) => { terminar = r; }));
    const t = abrir({ salvar, prepararFoto: vi.fn(async () => FOTO) });
    t.enviar(); t.enviar();
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    await act(async () => terminar({ nome: "Monica", foto: null }));
    await screen.findByText("Perfil atualizado!");
  });
  it("cancelar durante a preparação não aplica a foto atrasada nem grava", async () => {
    let terminar!: (p: string) => void;
    const foto = vi.fn(() => new Promise<string>((r) => { terminar = r; }));
    const salvar = vi.fn();
    abrir({ salvar, prepararFoto: foto });
    fireEvent.change(screen.getByLabelText("Selecionar foto de perfil"), { target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByText("Preparando foto…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await act(async () => terminar(FOTO));
    fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));
    expect(screen.queryByAltText("Foto de perfil")).toBeNull();
    expect(salvar).not.toHaveBeenCalled();
  });
  it("nome vazio não grava", () => {
    const t = abrir();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: " " } });
    t.enviar(); expect(screen.getByRole("alert")).toHaveTextContent("Informe seu nome.");
    expect(t.salvar).not.toHaveBeenCalled();
  });
});
