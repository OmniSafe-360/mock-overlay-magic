type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  track?: (event: string, properties?: Record<string, unknown>) => string | null;
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

// Telemetria recebe só classificação e rota conhecida; nunca o erro bruto.
export function erroParaTelemetria(error: unknown): Error {
  let message = "Falha de execução na interface.";
  let name = "Error";
  try {
    if (error instanceof Response) message = `Resposta HTTP ${error.status}.`;
    if (error instanceof Error && ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError"].includes(error.name)) name = error.name;
  } catch {
    // Um objeto lançado pode ter getters que falham; não inspecionar seus dados.
  }
  const safe = new Error(message);
  safe.name = name;
  Object.defineProperty(safe, "stack", { value: undefined, configurable: true, writable: true });
  return safe;
}

function rotaParaTelemetria(pathname: string): string {
  if (["/", "/funcionario", "/caixa", "/conector"].includes(pathname)) return pathname;
  if (pathname.startsWith("/pedido/")) return "/pedido/:token";
  if (pathname.startsWith("/fiado/") || pathname.startsWith("/api/public/fiado-manifest.")) return "/fiado/:token";
  return "[outra_rota]";
}

export function reportLovableError(error: unknown, _context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const safe = erroParaTelemetria(error);
  const route = rotaParaTelemetria(window.location.pathname);
  window.__lovableEvents?.captureException?.(
    safe,
    { source: "react_error_boundary", route, boundary: "tanstack_root_error_component" },
    { mechanism: "react_error_boundary", handled: false, severity: "error" },
  );
  window.__lovableReportRuntimeError?.({ message: safe.message, filename: route });
}
