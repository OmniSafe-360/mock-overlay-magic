import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Scanner, classifyCameraError, SCAN_ERROR_MSG, CAMERA_PREFERIDA, INTERVALO_LEITURA_MS, cropParaVideo } from "@/components/Scanner";
import { ProductWizard } from "@/components/ProductArea";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// Simula a câmera do navegador e a biblioteca de leitura (o componente Scanner real é usado).
const z = vi.hoisted(() => ({ next: null as null | string, formato: null as number | null, decodes: 0, hints: null as Map<unknown, unknown> | null, gum: null as unknown as ReturnType<typeof vi.fn>, stop: null as unknown as ReturnType<typeof vi.fn>, apply: null as unknown as ReturnType<typeof vi.fn>, caps: {} as Record<string, unknown>, draws: [] as number[][] }));
vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    constructor(hints: Map<unknown, unknown>) { z.hints = hints; }
    decodeFromCanvas() { z.decodes++; if (z.next == null) throw new Error("NotFound"); return { getText: () => z.next, getBarcodeFormat: () => z.formato }; }
  },
}));

const flush = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 20)); });
const ler = async (t: string) => { z.next = t; await flush(); };
const fakeStream = () => ({
  getTracks: () => [{ stop: z.stop }],
  getVideoTracks: () => [{ stop: z.stop, getCapabilities: () => z.caps, applyConstraints: z.apply }],
});

beforeEach(() => {
  z.next = null; z.formato = null; z.decodes = 0; z.hints = null; z.caps = {}; z.draws = [];
  z.stop = vi.fn(); z.apply = vi.fn(async () => {});
  z.gum = vi.fn(async () => fakeStream());
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: z.gum }, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, "play", { value: async () => {}, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { get: () => 4, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { get: () => 1280, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { get: () => 720, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, "srcObject", { value: null, writable: true, configurable: true });
  HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: (...a: number[]) => z.draws.push(a.slice(1, 5)) })) as never;
});
afterEach(cleanup);

describe("Scanner", () => {
  it("habilita ITF só para Mercado, limitado a 14 dígitos, e entrega à chamada certa", async () => {
    const onCode = vi.fn();
    render(<Scanner mercado onCode={onCode} onType={() => {}} onClose={() => {}} />);
    await flush();
    expect(z.hints?.get(DecodeHintType.POSSIBLE_FORMATS)).toContain(BarcodeFormat.ITF);
    expect(z.hints?.get(DecodeHintType.ALLOWED_LENGTHS)).toEqual([14]);
    z.formato = BarcodeFormat.ITF;
    await ler("1234567890123456");
    expect(onCode).not.toHaveBeenCalled();
    await ler("17896263503200");
    expect(onCode).toHaveBeenCalledExactlyOnceWith("17896263503200");
  });
  it("mostra carregamento, prefere câmera traseira e entrega o código uma vez com zeros à esquerda", async () => {
    const onCode = vi.fn();
    render(<Scanner onCode={onCode} onType={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Abrindo a câmera...")).toBeTruthy();
    await flush();
    expect(z.gum.mock.calls[0]![0]).toEqual(CAMERA_PREFERIDA);
    expect(z.hints?.get(DecodeHintType.POSSIBLE_FORMATS)).not.toContain(BarcodeFormat.ITF);
    expect(screen.getByText("Centralize o código e mantenha o celular parado")).toBeTruthy();
    await ler("0012345678905");
    await ler("999");
    expect(onCode).toHaveBeenCalledTimes(1);
    expect(onCode).toHaveBeenCalledWith("0012345678905");
    expect(z.stop).toHaveBeenCalled();
  });

  it("pede câmera traseira só como preferência (ideal), sem exigências que impeçam abrir", () => {
    const v = CAMERA_PREFERIDA.video as Record<string, unknown>;
    expect(v["facingMode"]).toEqual({ ideal: "environment" });
    expect(v["width"]).toEqual({ ideal: 1280 });
    expect(JSON.stringify(v)).not.toMatch(/exact|min/);
  });

  it("tenta qualquer câmera se a traseira não existir", async () => {
    z.gum.mockRejectedValueOnce(Object.assign(new Error(), { name: "OverconstrainedError" }));
    render(<Scanner onCode={() => {}} onType={() => {}} onClose={() => {}} />);
    await flush();
    expect(z.gum.mock.calls[1]![0]).toEqual({ video: true, audio: false });
    expect(screen.getByText("Centralize o código e mantenha o celular parado")).toBeTruthy();
  });

  it("usa foco contínuo e lanterna quando o aparelho oferece", async () => {
    z.caps = { focusMode: ["manual", "continuous"], torch: true };
    render(<Scanner onCode={() => {}} onType={() => {}} onClose={() => {}} />);
    await flush();
    expect(z.apply).toHaveBeenCalledWith({ advanced: [{ focusMode: "continuous" }] });
    fireEvent.click(screen.getByRole("button", { name: /Lanterna/ }));
    await flush();
    expect(z.apply).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
  });

  it("sem foco contínuo nem lanterna, continua lendo normalmente", async () => {
    z.apply.mockRejectedValue(new Error("x"));
    const onCode = vi.fn();
    render(<Scanner onCode={onCode} onType={() => {}} onClose={() => {}} />);
    await flush();
    expect(z.apply).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Lanterna/ })).toBeNull();
    await ler("7891234567890");
    expect(onCode).toHaveBeenCalledWith("7891234567890");
  });

  it("tenta ler várias vezes por segundo, uma tentativa de cada vez", async () => {
    expect(INTERVALO_LEITURA_MS).toBeLessThan(500);
    render(<Scanner onCode={() => {}} onType={() => {}} onClose={() => {}} />);
    await flush();
    const antes = z.decodes;
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
    expect(z.decodes - antes).toBeGreaterThanOrEqual(3);
    expect(z.decodes - antes).toBeLessThanOrEqual(8);
  });

  it("permissão negada mostra orientação e permite tentar de novo", async () => {
    z.gum.mockRejectedValueOnce(Object.assign(new Error(), { name: "NotAllowedError" }));
    render(<Scanner onCode={() => {}} onType={() => {}} onClose={() => {}} />);
    await flush();
    expect(screen.getByText(SCAN_ERROR_MSG.denied)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    await flush();
    expect(z.gum).toHaveBeenCalledTimes(2);
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
    z.gum.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const onClose = vi.fn();
    const v = render(<Scanner onCode={() => {}} onType={() => {}} onClose={onClose} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Fechar câmera" }));
    expect(onClose).toHaveBeenCalled();
    v.unmount();
    await act(async () => { resolve(fakeStream()); for (let i = 0; i < 4; i++) await Promise.resolve(); });
    expect(z.stop).toHaveBeenCalled();
    const n = z.decodes; await flush();
    expect(z.decodes).toBe(n);
  });

  it("recorte corresponde à moldura com object-cover (vídeo deitado em tela em pé)", () => {
    // Vídeo 1280x720 numa tela 360x640: escala 640/720, sobra lateral cortada.
    const r = cropParaVideo(1280, 720, 360, 640, { x: 40, y: 208, w: 280, h: 224 }, 0)!;
    const s = 640 / 720, ox = (360 - 1280 * s) / 2;
    expect(r.x).toBe(Math.round((40 - ox) / s));
    expect(r.y).toBe(Math.round(208 / s));
    expect(r.w).toBe(Math.round(280 / s));
    expect(r.h).toBe(Math.round(224 / s));
  });

  it("recorte com vídeo em pé (aparelho girado) e margem fica dentro do quadro", () => {
    const r = cropParaVideo(720, 1280, 360, 640, { x: 0, y: 0, w: 360, h: 640 })!;
    expect(r).toEqual({ x: 0, y: 0, w: 720, h: 1280 });
    expect(cropParaVideo(0, 0, 360, 640, { x: 0, y: 0, w: 10, h: 10 })).toBeNull();
  });

  it("no cadastro, o código lido vai só para o código principal", async () => {
    render(<ProductWizard store={{ id: "m", nome: "M", tipo: "mercado" } as never} products={[]} suppliers={[]} onAddSupplier={() => 1} onCancel={() => {}} onSave={() => {}} />);
    fireEvent.click(screen.getByText("Escanear código"));
    await flush();
    await ler("0789");
    expect((screen.getByPlaceholderText("Ex.: 7891234567890") as HTMLInputElement).value).toBe("0789");
    expect((document.querySelector('input[name="pnome"]') as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("dialog", { name: "Escanear código" })).toBeNull();
  });
});
