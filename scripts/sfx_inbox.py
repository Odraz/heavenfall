"""Imports Suno and ElevenLabs WAV/MP3 downloads into the game's sound sources.

  python -I scripts/sfx_inbox.py import scourge <download.wav> --provider elevenlabs
      --provider suno imports Suno downloads. Copies explicitly listed files; originals stay
      untouched. --kind loops or --kind voice selects those source folders.
      --metadata <json> attaches actual generation settings/plan/history information to each take.
      A sidecar records the original name, hash, import date and suggested prompt/settings.
      --processing <json> supplies explicit cutting overrides, independent of provider.

  python -I scripts/sfx_inbox.py analyze [id ...]
      Measures every take in the inbox (or only these sounds'); SFX are listed best first: few
      separate events, no slow swell or riser, a quiet floor. Claude can't hear; this is what it
      picks by, and the human's ears decide in the game (in S1 the flags missed a double hit and
      a gunshot-like sledgehammer, so listening stays the real check). Loops/voices are not ranked
      or flagged with the one-shot rules.

  python -I scripts/sfx_inbox.py place <id> <take> [<take> ...] [--add]
      Preserves WAV/MP3 format and sidecars when placing keepers, archiving replacements in
      rejected/ and keeping alternatives in spare/. --add appends without replacing keepers.
      analyze/place accept --kind too. scripts/sfx_cut.py currently finishes all 17 S1 families;
      other IDs and loops/voices need their finishing/integration at the owning milestone.

Needs Python 3 with NumPy, and ffmpeg/ffprobe on the PATH.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = ROOT / "docs" / "rogue" / "audio-prompts.md"
SRC = ROOT / "assets" / "audio-src" / "sfx"
INBOX = SRC / "inbox"
SR = 48000
AUDIO_EXTENSIONS = (".wav", ".mp3")
PROVIDERS = {"suno": "Suno Sounds", "elevenlabs": "ElevenLabs"}


def read_object(path: pathlib.Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise ValueError(f"expected a JSON object: {path}")
    return data


def write_object(path: pathlib.Path, data: dict) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def next_free(folder: pathlib.Path, stem: str, sep: str = "-", width: int = 0, start: int = 1,
              suffix: str = ".mp3") -> pathlib.Path:
    n = start
    while True:
        p = folder / f"{stem}{sep}{n:0{width}d}{suffix}"
        if not any(p.with_suffix(ext).exists() for ext in (*AUDIO_EXTENSIONS, ".json")):
            return p
        n += 1


def audio_files(folder: pathlib.Path, pattern: str = "*") -> list[pathlib.Path]:
    return sorted(p for p in folder.glob(pattern) if p.suffix.lower() in AUDIO_EXTENSIONS)


def valid_id(sid: str) -> str:
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", sid):
        raise argparse.ArgumentTypeError("use a prompt ID containing letters, digits or hyphens")
    return sid


def prompt_snapshot(sid: str, provider: str) -> dict:
    """Suggested settings are not evidence of the settings used for a generation."""
    text = DOC.read_text(encoding="utf-8")
    section = re.search(rf"^#{{3,4}} {re.escape(sid)} —.*?(?=^#|\Z)", text, re.M | re.S)
    if section:
        blocks = re.findall(r"```text\n(.*?)\n```", section.group(), re.S)
        settings = re.search(r"^\*\*Generate:\*\* (.+)$", section.group(), re.M)
        return {"suggested_prompts": blocks,
                "elevenlabs_suggested_settings": settings.group(1) if settings and provider == "elevenlabs" else None}
    row = re.search(rf"^\| `{re.escape(sid)}` \|.*$", text, re.M)
    return {"suggested_document_row": row.group() if row else None}


def import_takes(sid: str, files: list[pathlib.Path], *, provider: str,
                 metadata: dict | None = None, processing: dict | None = None) -> list[pathlib.Path]:
    valid_id(sid)
    if provider not in PROVIDERS:
        raise ValueError("provider must be suno or elevenlabs")
    metadata = {} if metadata is None else metadata
    processing = {} if processing is None else processing
    if not isinstance(metadata, dict) or not isinstance(processing, dict):
        raise ValueError("generation metadata and processing settings must be JSON objects")
    # The explicit provider is authoritative; don't accept a contradictory metadata label.
    for key, expected in (("provider", provider), ("tool", PROVIDERS[provider])):
        if key in metadata and metadata[key] != expected:
            raise ValueError(f"metadata {key} conflicts with provider {provider}")
    # Validate the entire batch before copying any take. ffprobe checks the actual audio codec.
    prepared = []
    for p in files:
        p = p.resolve(strict=True)
        if p.suffix.lower() not in AUDIO_EXTENSIONS:
            sys.exit(f"expected WAV or MP3: {p.name}")
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                            "stream=codec_name", "-of", "default=nw=1:nk=1", str(p)],
                           capture_output=True, text=True, check=True)
        if not r.stdout.strip():
            sys.exit(f"no audio stream: {p.name}")
        prepared.append((p, hashlib.sha256(p.read_bytes()).hexdigest()))
    INBOX.mkdir(parents=True, exist_ok=True)
    # Deduplicate this family's inbox only. Installed/rejected sources may be deliberately
    # re-staged for a new mixed selection, and other families may reuse the same source.
    existing = {}
    for p in audio_files(INBOX, f"{sid}-*"):
        if not re.fullmatch(rf"{re.escape(sid)}-\d+", p.stem) or not p.with_suffix(".json").exists():
            continue
        record = read_object(p.with_suffix(".json"))
        if (record.get("tool") == PROVIDERS[provider] and record.get("generation") == metadata
                and record.get("processing", {}) == processing):
            digest = hashlib.sha256(p.read_bytes()).hexdigest()
            if record.get("source_sha256") != digest:
                raise ValueError(f"staged source differs from its provenance hash: {p.name}")
            existing[digest] = p
    snapshot = prompt_snapshot(sid, provider)
    imported = []
    for p, digest in prepared:
        if digest in existing:
            imported.append(existing[digest])
            print(f"already staged: {p.name} -> {existing[digest].name}")
            continue
        dst = next_free(INBOX, sid, suffix=p.suffix.lower())
        record = {"provider": provider, "tool": PROVIDERS[provider], "prompt_id": sid, "original_name": p.name,
                  "source_sha256": digest, "imported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  "suggested_document": snapshot, "generation": metadata, "processing": processing}
        shutil.copy2(p, dst)
        write_object(dst.with_suffix(".json"), record)
        existing[digest] = dst
        imported.append(dst)
        print(f"{dst.name} <- {p.name} (copied)")
    return imported


def move_take(src: pathlib.Path, dst: pathlib.Path) -> None:
    if any(dst.with_suffix(ext).exists() for ext in (*AUDIO_EXTENSIONS, ".json")):
        raise ValueError(f"destination take already exists: {dst}")
    shutil.move(str(src), dst)
    sidecar = src.with_suffix(".json")
    if sidecar.exists():
        shutil.move(str(sidecar), dst.with_suffix(".json"))


def measure(path: pathlib.Path) -> dict:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    hop = SR // 200  # 5 ms
    n = len(x) // hop
    if n == 0 or not np.isfinite(x).all() or np.max(np.abs(x)) < 1e-8:
        raise ValueError(f"audio is too short, silent or contains invalid samples: {path.name}")
    db = 20 * np.log10(np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(axis=1)) + 1e-9)
    peak = db.max()
    on = db > peak - 30
    events, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and (on[j] or on[j:j + 8].any()):
                j += 1
            events.append((i, j))
            i = j
        else:
            i += 1
    first = events[0][0] if events else 0
    peak_i = int(db.argmax())
    seg = x[peak_i * hop: peak_i * hop + SR // 5]
    seg = np.pad(seg, (0, max(0, 2048 - len(seg))))
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    freqs = np.fft.rfftfreq(len(seg), 1 / SR)
    m = {
        "length": len(x) / SR,
        "starts_ms": first * 5,
        "swell_ms": (peak_i - first) * 5,
        "events": len(events),
        "floor_db": float(np.percentile(db, 5) - peak),
        "brightness_hz": float((spec * freqs).sum() / (spec.sum() + 1e-9)),
    }
    flags = []
    if m["swell_ms"] > 300:
        flags.append("slow swell or riser")
    if m["events"] > 2:
        flags.append(f"{m['events']} separate events")
    if m["floor_db"] > -45:
        flags.append("noisy floor")
    m["flags"] = flags
    return m


def analyze(ids: list[str]) -> None:
    takes = audio_files(INBOX)
    by_id: dict[str, list[pathlib.Path]] = {}
    for p in takes:
        sid = p.stem.rsplit("-", 1)[0]
        if not ids or sid in ids:
            by_id.setdefault(sid, []).append(p)
    if not by_id:
        print("inbox is empty" if not takes else "no takes for those sounds")
    for sid, paths in by_id.items():
        print(f"\n{sid}")
        rows = [(p, measure(p)) for p in paths]
        if SRC.name == "sfx":
            rows.sort(key=lambda r: (len(r[1]["flags"]), r[1]["floor_db"]))
        for p, m in rows:
            take = p.stem.rsplit("-", 1)[1]
            print(f"  take {take}: {m['length']:.1f} s, hit at {m['starts_ms']} ms, loudest {m['swell_ms']} ms later, "
                  f"{m['events']} event(s), floor {m['floor_db']:.0f} dB, brightness {m['brightness_hz']:.0f} Hz"
                  + (f"  [{'; '.join(m['flags'])}]" if m["flags"] and SRC.name == "sfx" else ""))


def place(sid: str, chosen: list[str], add: bool) -> None:
    valid_id(sid)
    if not chosen:
        sys.exit("choose at least one take")
    if len(set(chosen)) != len(chosen):
        sys.exit("choose each take only once")
    paths = [p for p in audio_files(INBOX, f"{sid}-*")
             if re.fullmatch(rf"{re.escape(sid)}-\d+", p.stem)]
    inbox = {p.stem.rsplit("-", 1)[1]: p for p in paths}
    if len(inbox) != len(paths):
        sys.exit("duplicate inbox take numbers across formats; rename before placing")
    missing = [t for t in chosen if t not in inbox]
    if missing:
        sys.exit(f"not in the inbox: {sid} take(s) {', '.join(missing)}")
    current = audio_files(SRC, f"{sid}-*")
    current = [p for p in current if re.fullmatch(rf"{re.escape(sid)}-\d+", p.stem)]
    start = 1
    if add:
        start = max((int(p.stem.rsplit("-", 1)[1]) for p in current), default=0) + 1
    # Check every destination before archiving current sources. A leftover sidecar or
    # another format must not cause a partial replacement after the old set has moved.
    moving = set(current) | {p.with_suffix(".json") for p in current} if not add else set()
    for k, t in enumerate(chosen):
        dst = SRC / f"{sid}-{start + k:02d}{inbox[t].suffix}"
        for ext in (*AUDIO_EXTENSIONS, ".json"):
            candidate = dst.with_suffix(ext)
            if candidate.exists() and candidate not in moving:
                sys.exit(f"destination take already exists: {candidate}")
    if not add and current:
        (SRC / "rejected").mkdir(exist_ok=True)
        v = 1
        while list((SRC / "rejected").glob(f"{sid}-v{v}-*")):
            v += 1
        for p in current:
            dst = SRC / "rejected" / f"{sid}-v{v}-{p.stem.rsplit('-', 1)[1]}{p.suffix}"
            move_take(p, dst)
            print(f"{p.name} -> rejected/{dst.name}")
    for k, t in enumerate(chosen):
        take = inbox.pop(t)
        dst = SRC / f"{sid}-{start + k:02d}{take.suffix}"
        move_take(take, dst)
        print(f"inbox take {t} -> {dst.name}")
    (SRC / "spare").mkdir(exist_ok=True)
    for t, p in sorted(inbox.items()):
        dst = next_free(SRC / "spare", sid, width=2, start=start + len(chosen), suffix=p.suffix)
        move_take(p, dst)
        print(f"inbox take {t} -> spare/{dst.name}")
    if SRC.name == "sfx":
        print(f"finish/integrate {sid}; scripts/sfx_cut.py supports all 17 S1 families")
    else:
        print(f"ready for {SRC.name} finishing/integration: {sid}")


def main() -> None:
    global SRC, INBOX
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    imp = sub.add_parser("import")
    imp.add_argument("id", type=valid_id)
    imp.add_argument("files", type=pathlib.Path, nargs="+")
    imp.add_argument("--provider", choices=PROVIDERS, required=True)
    imp.add_argument("--metadata", type=pathlib.Path)
    imp.add_argument("--processing", type=pathlib.Path)
    a = sub.add_parser("analyze")
    a.add_argument("ids", nargs="*")
    p = sub.add_parser("place")
    p.add_argument("id", type=valid_id)
    p.add_argument("takes", nargs="+")
    p.add_argument("--add", action="store_true", help="keep the current takes and number after them")
    for parser in (imp, a, p):
        parser.add_argument("--kind", choices=("sfx", "loops", "voice"), default="sfx")
    args = ap.parse_args()
    SRC = ROOT / "assets" / "audio-src" / args.kind
    INBOX = SRC / "inbox"
    if args.cmd == "analyze":
        analyze(args.ids)
    elif args.cmd == "import":
        import_takes(args.id, args.files, provider=args.provider,
                     metadata=read_object(args.metadata) if args.metadata else None,
                     processing=read_object(args.processing) if args.processing else None)
    else:
        place(args.id, args.takes, args.add)


if __name__ == "__main__":
    main()
