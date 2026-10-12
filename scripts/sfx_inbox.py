"""Brings Suno takes from the Downloads folder into the game's sound sources (docs/rogue/audio-prompts.md).

The workflow: the human clicks Create in Suno; Claude downloads the takes with usesuno.com's batch
downloader (MP3), which saves them in Downloads under random names. Then:

  python -I scripts/sfx_inbox.py collect [--watch 120]
      Moves every downloaded take into assets/audio-src/rogue/sfx/inbox/<id>-<n>.mp3. A Suno MP3
      keeps its full prompt in the `genre` tag; the take's <id> is the sound whose prompt in
      audio-prompts.md it matches (current prompts and the older ones quoted under them). Takes
      that match no prompt stay where they are and are listed. --watch keeps collecting for that
      many seconds, for downloads still arriving (and the save dialogs being clicked).

  python -I scripts/sfx_inbox.py analyze [id ...]
      Measures every take in the inbox (or only these sounds') and lists them best first: few
      separate events, no slow swell or riser, a quiet floor. Claude can't hear; this is what it
      picks by, and the human's ears decide in the game (in S1 the flags missed a double hit and
      a gunshot-like sledgehammer, so listening stays the real check).

  python -I scripts/sfx_inbox.py place <id> <take> [<take> ...] [--add]
      Makes the listed inbox takes <id>-01.mp3, -02, ... in assets/audio-src/rogue/sfx/, moving the
      sound's current takes to rejected/<id>-v<k>-NN.mp3 (--add: keeps them and numbers after
      them). Its other inbox takes go to spare/. Then run scripts/sfx_cut.py <id>.

Needs Python 3 with NumPy, and ffmpeg/ffprobe on the PATH.
"""
import argparse
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = ROOT / "docs" / "rogue" / "audio-prompts.md"
SRC = ROOT / "assets" / "audio-src" / "rogue" / "sfx"
INBOX = SRC / "inbox"
DOWNLOADS = pathlib.Path(os.environ.get("USERPROFILE", str(pathlib.Path.home()))) / "Downloads"
HOUSE = ("Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. "
         "No music, beat, voice, ambience or reverb.")
SR = 48000


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def prompts() -> list[tuple[str, str, bool]]:
    """(id, normalized text, whole prompt?) for every prompt in the doc: the ```text blocks, the
    S9 table rows (with the house sentence) and the older prompts quoted under a sound."""
    out: list[tuple[str, str, bool]] = []
    sid = None
    lines = DOC.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"#{3,4} (\S+) —", line)
        if m:
            sid = m.group(1)
        elif line.startswith("#"):
            sid = None
        elif line.strip() == "```text" and sid:
            out.append((sid, norm(lines[i + 1]), True))
        elif sid and line.lstrip().startswith(("*", "-")):
            for q in re.findall(r"\"([^\"]{40,})\"", line):
                out.append((sid, norm(q), False))
        t = re.match(r"\| `([^`]+)` \| \d \| ([^|]+) \|$", line)
        if t:
            out.append((t.group(1), norm(f"{t.group(2).strip()} {HOUSE}"), True))
            out.append((t.group(1), norm(t.group(2)), False))
        i += 1
    return out


def tag(path: pathlib.Path, name: str) -> str:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", f"format_tags={name}", "-of", "default=nw=1:nk=1", str(path)],
                       capture_output=True, text=True)
    return r.stdout.strip()


def is_audio(path: pathlib.Path) -> bool:
    with open(path, "rb") as f:
        head = f.read(3)
    return head == b"ID3" or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")


def match(genre: str, known: list[tuple[str, str, bool]]) -> str | None:
    g = norm(genre)
    for sid, text, whole in known:
        if (whole and g == text) or (not whole and g.startswith(text)):
            return sid
    return None


def next_free(folder: pathlib.Path, stem: str, sep: str = "-", width: int = 0, start: int = 1) -> pathlib.Path:
    n = start
    while True:
        p = folder / f"{stem}{sep}{n:0{width}d}.mp3"
        if not p.exists():
            return p
        n += 1


def collect(src: pathlib.Path, watch: float) -> None:
    INBOX.mkdir(parents=True, exist_ok=True)
    known = prompts()
    seen_unknown: set[pathlib.Path] = set()
    end = time.time() + watch
    while True:
        for p in sorted(list(src.glob("*.tmp")) + list(src.glob("*.mp3")), key=lambda p: p.stat().st_mtime):
            try:
                if not is_audio(p):
                    continue
                genre = tag(p, "genre")
            except OSError:
                continue  # still being written
            sid = match(genre, known) if genre else None
            if not sid:
                if p not in seen_unknown and genre:
                    print(f"no matching prompt, left in place: {p.name} ({genre[:60]}...)")
                seen_unknown.add(p)
                continue
            dst = next_free(INBOX, sid)
            shutil.move(str(p), dst)
            print(f"{dst.name}  <- {p.name}")
        if time.time() >= end:
            break
        time.sleep(1)


def measure(path: pathlib.Path) -> dict:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    hop = SR // 200  # 5 ms
    n = len(x) // hop
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
    takes = sorted(INBOX.glob("*.mp3"))
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
        rows.sort(key=lambda r: (len(r[1]["flags"]), r[1]["floor_db"]))
        for p, m in rows:
            take = p.stem.rsplit("-", 1)[1]
            print(f"  take {take}: {m['length']:.1f} s, hit at {m['starts_ms']} ms, loudest {m['swell_ms']} ms later, "
                  f"{m['events']} event(s), floor {m['floor_db']:.0f} dB, brightness {m['brightness_hz']:.0f} Hz"
                  + (f"  [{'; '.join(m['flags'])}]" if m["flags"] else ""))


def place(sid: str, chosen: list[str], add: bool) -> None:
    inbox = {p.stem.rsplit("-", 1)[1]: p for p in INBOX.glob(f"{sid}-*.mp3")}
    missing = [t for t in chosen if t not in inbox]
    if missing:
        sys.exit(f"not in the inbox: {sid} take(s) {', '.join(missing)}")
    current = sorted(SRC.glob(f"{sid}-[0-9][0-9].mp3"))
    start = 1
    if add:
        start = len(current) + 1
    elif current:
        (SRC / "rejected").mkdir(exist_ok=True)
        v = 1
        while list((SRC / "rejected").glob(f"{sid}-v{v}-*.mp3")):
            v += 1
        for p in current:
            dst = SRC / "rejected" / f"{sid}-v{v}-{p.stem[-2:]}.mp3"
            shutil.move(str(p), dst)
            print(f"{p.name} -> rejected/{dst.name}")
    for k, t in enumerate(chosen):
        dst = SRC / f"{sid}-{start + k:02d}.mp3"
        shutil.move(str(inbox.pop(t)), dst)
        print(f"inbox take {t} -> {dst.name}")
    (SRC / "spare").mkdir(exist_ok=True)
    for t, p in sorted(inbox.items()):
        dst = next_free(SRC / "spare", sid, width=2, start=start + len(chosen))
        shutil.move(str(p), dst)
        print(f"inbox take {t} -> spare/{dst.name}")
    print(f"now: python -I scripts/sfx_cut.py {sid}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("collect")
    c.add_argument("--from", dest="src", type=pathlib.Path, default=DOWNLOADS)
    c.add_argument("--watch", type=float, default=0, help="keep collecting for this many seconds")
    a = sub.add_parser("analyze")
    a.add_argument("ids", nargs="*")
    p = sub.add_parser("place")
    p.add_argument("id")
    p.add_argument("takes", nargs="+")
    p.add_argument("--add", action="store_true", help="keep the current takes and number after them")
    args = ap.parse_args()
    if args.cmd == "collect":
        collect(args.src, args.watch)
    elif args.cmd == "analyze":
        analyze(args.ids)
    else:
        place(args.id, args.takes, args.add)


if __name__ == "__main__":
    main()
