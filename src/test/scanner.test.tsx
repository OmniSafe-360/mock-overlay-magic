import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Scanner, classifyCameraError, SCAN_ERROR_MSG } from "@/components/Scanner";
import { ProductWizard } from "@/components/ProductArea";

// Simula apenas a biblioteca de leitura (o componente Scanner real é usado).
const z = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn(), cb: null as null | ((r: unknown) => void) }));
vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class { decodeFromConstraints(...a: unknown[]) { return z.decode(...a); } },
}));

const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); });
const res = (t: string) => ({ getText: () => t });

beforeEach(() => {
  z.stop.mockReset(); z.cb = null;
  z.decode.mockReset().mockImplementation(async (_c: unknown, _v: unknown, cb: (r: unknown) => void) => { z.cb = cb; return { stop: z.stop }; });
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn() }, configurable: true });
});
afterEach(cleanup);

describe("Scanner", () => {
  it("mostra carregamento, prefere câmera traseira e entrega o código uma vez com zeros à esquerda", async () => {
    const onCode = vi.fn();
    render(<Scanner onCode={onCode} onType={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Abrindo a câmera...")).toBeTruthy();
    await flush();
    expect(z.decode.mock.calls[0]![0]).toEqual({ video: { facingMode: { ideal: "environment" } } });
    act(() => { z.cb!(res("0012345678905")); z.cb!(res("0012345678905")); z.cb!(res("999")); });
    expect(onCode).toHaveBeenCalledTimes(1);
    expect(onCode).toHaveBeenCalledWith("0012345678905");
    expect(z.stop).toHaveBeenCalled();
  });

  it("tenta qualquer câmera se a traseira não existir", async () => {
    z.decode.mockRejectedValueOnce(Object.assign(new Error(), { name: "OverconstrainedError" }));
    render(<Scanner onCode={() => {}} onType={() => {}} onClose={() => {}} />);
    await flush();
    expect(z.decode.mock.calls[1]![0]).toEqual({ video: true });
    expect(screen.getByText("Aponte para o código de barras ou QR Code")).toBeTruthy();
  });

  it("permissão negada mostra orientação e permite tentar de novo", async () => {
    z.decode.mockRejectedValueOnce(Object.assign(new Error(), { name: "NotAllowedError" }));
    render(<Scanner onCode={() => {}} onType={() => {}} onClose={() => {}} />);
    await flush();
    expect(screen.getByText(SCAN_ERROR_MSG.denied)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    await flush();
    expect(z.decode).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(SCAN_ERROR_MSG.denied)).toBeNull();
  });

  it("navegador sem câmera mostra aviso de incompatível", async () => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    render(<Scanner onCode={() => {}} onType={() => {}} onClose={() => {}} />);
    await flush();
    expect(screen.getByText(SCAN_ERROR_MSG.unsupported)).toBeTruthy();
  });

  it("classifica os erros da câmera", () => {
    const e = (name: string) => ({ name });
    expect(classifyCameraError(e("NotAllowedError"))).toBe("denied");
    expect(classifyCameraError(e("NotFoundError"))).toBe("nocamera");
    expect(classifyCameraError(e("NotReadableError"))).toBe("busy");
    expect(classifyCameraError(e("Qualquer"))).toBe("failed");
  });

  it("fechar e desmontar encerram a câmera, inclusive se a inicialização terminar depois", async () => {
    let resolve!: (c: unknown) => void;
    z.decode.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const onClose = vi.fn();
    const v = render(<Scanner onCode={() => {}} onType={() => {}} onClose={onClose} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Fechar câmera" }));
    expect(onClose).toHaveBeenCalled();
    v.unmount();
    await act(async () => { resolve({ stop: z.stop }); await Promise.resolve(); await Promise.resolve(); });
    expect(z.stop).toHaveBeenCalled();
  });

  it("no cadastro, o código lido vai só para o código principal", async () => {
    render(<ProductWizard store={{ id: "m", nome: "M", tipo: "mercado" } as never} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    fireEvent.click(screen.getByText("Escanear código"));
    await flush();
    act(() => { z.cb!(res("0789")); });
    expect((screen.getByPlaceholderText("Ex.: 7891234567890") as HTMLInputElement).value).toBe("0789");
    expect((document.querySelector('input[name="pnome"]') as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("dialog", { name: "Escanear código" })).toBeNull();
  });
});
