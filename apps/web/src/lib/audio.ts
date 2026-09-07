// ───────────────────────────────────────────────────────────────────────────
// Die EINE Rechnung fuer Mikrofon-Pegel und PCM.
//
// BEFUND (Defektformen-Sweep, Form `zwei-rechnungen`, gemessen 2026-09-07).
// `Softclient.tsx` und `PhoneClient.tsx` sind zwei Ansichten derselben App,
// sie sprechen dasselbe Protokoll mit demselben Kern — und sie hatten drei
// Rechnungen doppelt:
//
//   * `downsampleToInt16` und `int16ToBase64` standen Zeile fuer Zeile in
//     beiden Dateien (nur die Namen der Zwischenvariablen unterschieden sich).
//     Beide fuettern denselben `transcribe_audio`-Weg; wer eine korrigiert,
//     korrigiert die andere nicht.
//
//   * Der Mikrofon-Pegel wurde in beiden Ansichten aus DEMSELBEN Signal
//     berechnet, aber mit ZWEI verschiedenen Formeln, und beide zeigten das
//     Ergebnis als „%" auf demselben Balken:
//
//         Softclient   getByteFrequencyData -> Mittel aller Bins / 255 * 100
//         PhoneClient  getByteTimeDomainData -> RMS * 400
//
//     Das ist nicht dieselbe Groesse. Der Mittelwert ueber ALLE FFT-Bins ist
//     bei Sprache systematisch niedrig — die meisten Bins sind fast leer —,
//     die Zeitbereichs-RMS misst den tatsaechlichen Ausschlag. Dieselbe
//     Stimme las auf dem Softclient ein Vielfaches weniger als auf dem
//     Telefon, und niemand konnte das der Anzeige ansehen: beide Balken
//     heissen „Mic" und beide enden bei 100 %.
//
//     Es blieb nicht bei der Anzeige. Der Softclient vergleicht seine VOX-
//     Schwelle gegen genau diese Zahl. Wer den Pegel am Telefon ablas und
//     die Schwelle danach setzte, bekam ein Mikrofon, das nie aufmacht.
//
// Deshalb steht die Rechnung hier, einmal. Die Zeitbereichs-RMS hat gewonnen,
// weil sie die richtige ist; der Kommentar im PhoneClient sagte das seit
// jeher („Time-domain RMS for accurate level metering"), nur galt er dort
// allein.
//
// ACHTUNG BEIM UMSTELLEN: eine bereits eingestellte VOX-Schwelle im
// Softclient ist auf die alte, zu niedrige Skala geeicht und gehoert einmal
// neu eingestellt — der Balken daneben zeigt jetzt die Skala, gegen die sie
// verglichen wird.
// ───────────────────────────────────────────────────────────────────────────

/** Faktor, mit dem die RMS (0..1) auf die Prozent-Anzeige gedehnt wird. */
const PEGEL_DEHNUNG = 400;

/**
 * Mikrofon-Pegel in Prozent (0..100) aus einem Zeitbereichs-Puffer.
 *
 * `daten` ist, was `AnalyserNode.getByteTimeDomainData()` liefert: 8-Bit-
 * Abtastwerte um die Mitte 128. Ein stilles Mikrofon liegt konstant bei 128
 * und ergibt 0.
 */
export function mikrofonPegel(daten: Uint8Array): number {
  if (daten.length === 0) return 0;
  let summeQuadrate = 0;
  for (let i = 0; i < daten.length; i += 1) {
    const v = (daten[i] - 128) / 128;
    summeQuadrate += v * v;
  }
  const rms = Math.sqrt(summeQuadrate / daten.length);
  return Math.min(100, Math.round(rms * PEGEL_DEHNUNG));
}

/** Ein Float-Abtastwert (-1..1) als 16-Bit-Ganzzahl. */
function alsInt16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample));
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
}

/**
 * Float32-Mono auf `outputRate` heruntertasten und als Int16 ausgeben.
 *
 * Gemittelt wird ueber das Fenster zwischen zwei Ausgabewerten — kein
 * Nachbar-Abgreifen, sonst klingt die Transkriptionsspur nach Aliasing.
 */
export function downsampleToInt16(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Int16Array {
  if (inputRate === outputRate) {
    const direct = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) direct[i] = alsInt16(input[i]);
    return direct;
  }

  const ratio = inputRate / outputRate;
  const outLength = Math.round(input.length / ratio);
  const result = new Int16Array(outLength);
  let outIdx = 0;
  let inIdx = 0;

  while (outIdx < outLength) {
    const nextInIdx = Math.round((outIdx + 1) * ratio);
    let total = 0;
    let count = 0;
    for (let i = inIdx; i < Math.min(nextInIdx, input.length); i += 1) {
      total += input[i];
      count += 1;
    }
    result[outIdx] = alsInt16(count > 0 ? total / count : 0);
    outIdx += 1;
    inIdx = nextInIdx;
  }

  return result;
}

/** Int16-PCM als Base64 — das Format, das `transcribe_audio` erwartet. */
export function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
