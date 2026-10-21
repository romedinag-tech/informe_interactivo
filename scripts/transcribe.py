# Transcribe audio LOCALMENTE con faster-whisper (modelo `small`, el único descargado).
# No manda nada a la nube.
#
# Dos modos:
#   python -X utf8 scripts/transcribe.py <audio.webm>     # una vez (CLI/prueba)
#   python -X utf8 scripts/transcribe.py --server         # persistente: carga el
#       modelo UNA vez e imprime "READY"; luego lee una ruta de audio por línea en
#       stdin y responde "T\t<transcripción>" por línea. Evita recargar el modelo
#       (que son ~28 s) en cada dictado.
#
# Cuidados (memoria global de Rodrigo):
#  - `vad_filter=False`: el filtro de voz descarta en SILENCIO los tramos de volumen
#    bajo; ya costó ~11 min de una reunión. Acá no se filtra.
#  - stdout en UTF-8: con la salida redirigida Windows usa cp1252 y un acento revienta.
#  - CPU + int8: la GPU de este equipo está apagada por el driver (ver memoria global).
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def cargar():
    from faster_whisper import WhisperModel
    return WhisperModel("small", device="cpu", compute_type="int8")


def transcribe(model, audio: str) -> str:
    segs, _ = model.transcribe(audio, language="es", vad_filter=False, beam_size=1)
    return " ".join(s.text.strip() for s in segs).strip().replace("\n", " ")


def main() -> int:
    args = sys.argv[1:]
    if "--server" in args:
        model = cargar()
        print("READY", flush=True)
        for line in sys.stdin:
            ruta = line.strip()
            if not ruta:
                continue
            try:
                txt = transcribe(model, ruta)
            except Exception as e:  # noqa: BLE001
                print("transcribe error:", str(e)[:200], file=sys.stderr, flush=True)
                txt = ""
            print("T\t" + txt, flush=True)
        return 0
    if not args:
        return 2
    print(transcribe(cargar(), args[0]), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
