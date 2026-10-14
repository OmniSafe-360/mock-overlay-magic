/** Sons opcionais para confirmação de leitura de código de barras.
 * Não altera a validação, o catálogo ou os fluxos de estoque.
 * Chamar apenas após o fluxo existente decidir o resultado da leitura.
 */
type ScanResult = "success" | "error";
let context: AudioContext | null = null;
let lastSound: { result: ScanResult; at: number } | null = null;

export function enableBarcodeScanAudio(): void {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  try {
    context ??= new AudioContextClass();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Áudio não é essencial: nunca interromper a leitura.
  }
}

export function playBarcodeScanSound(result: ScanResult): void {
  if (typeof window === "undefined") return;
  const now = performance.now();
  if (lastSound?.result === result && now - lastSound.at < 850) return;
  lastSound = { result, at: now };
  try {
    enableBarcodeScanAudio();
    if (!context || context.state !== "running") return;
    const start = context.currentTime;
    const notes = result === "success"
      ? [{ hz: 880, offset: 0, duration: 0.085 }]
      : [{ hz: 330, offset: 0, duration: 0.12 }, { hz: 260, offset: 0.15, duration: 0.14 }];
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.hz, start + note.offset);
      gain.gain.setValueAtTime(0.0001, start + note.offset);
      gain.gain.exponentialRampToValueAtTime(0.13, start + note.offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.offset + note.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + note.offset);
      oscillator.stop(start + note.offset + note.duration + 0.01);
    }
  } catch {
    // Falha de áudio não pode bloquear operações comerciais.
  }
}
