import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

// jsdom não implementa Web Crypto, disponível nos navegadores HTTPS usados pelo app.
Object.defineProperty(globalThis.crypto, "subtle", { configurable: true, value: webcrypto.subtle });

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
