"""Import, select and finish S1 families from Suno, ElevenLabs or mixed session JSON.

Usage: python -I scripts/sfx_finish_session.py <session.json> [sound-id ...]
Each job supplies downloaded files and `select`: their 1-based positions, in keeper order.
Provider defaults at session/job level may be overridden per file. Generation metadata belongs
to that provider; processing overrides describe the take's attack, independently of provider.
--auto-select explicitly opts into signal ranking (job `keep` defaults to three).
Alternatives and replaced sources/runtime WAVs are retained. Listening remains essential.
"""
import argparse
import hashlib
import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_script(name: str):
    # Works under python -I without relying on scripts/ being on sys.path.
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare_job(sid: str, job: dict, provider_default: str | None, manifest: pathlib.Path,
                auto_select: bool, inbox, cutter) -> dict:
    inbox.valid_id(sid)
    if sid not in cutter.SOUNDS:
        raise ValueError(f"{sid}: no S1 finishing rule")
    if not isinstance(job, dict) or not isinstance(job.get("files"), list) or not job["files"]:
        raise ValueError(f"{sid}: files must be a nonempty array")
    selection = job.get("select")
    if selection is not None:
        if (not isinstance(selection, list) or not selection
                or any(type(i) is not int or not 1 <= i <= len(job["files"]) for i in selection)
                or len(selection) != len(set(selection))):
            raise ValueError(f"{sid}: select must contain distinct 1-based file positions")
    elif not auto_select:
        raise ValueError(f"{sid}: supply select after listening, or explicitly use --auto-select")
    keep = job.get("keep", 3) if selection is None else len(selection)
    if type(keep) is not int or not 1 <= keep <= len(job["files"]):
        raise ValueError(f"{sid}: keep must be between 1 and the number of files")
    job_provider = job.get("provider", provider_default)
    generation = job.get("generation", {})
    processing = job.get("processing", {})
    if not isinstance(generation, dict) or not isinstance(processing, dict):
        raise ValueError(f"{sid}: generation and processing must be JSON objects")
    entries = []
    for index, entry in enumerate(job["files"], 1):
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
            raise ValueError(f"{sid} file {index}: supply an object with a path")
        provider = entry.get("provider", job_provider)
        if provider not in inbox.PROVIDERS:
            raise ValueError(f"{sid} file {index}: provider must be suno or elevenlabs")
        actual = entry.get("generation", {})
        overrides = entry.get("processing", {})
        if not isinstance(actual, dict) or not isinstance(overrides, dict):
            raise ValueError(f"{sid} file {index}: generation and processing must be JSON objects")
        # A provider override must not inherit the other provider's generation settings.
        metadata = {**(generation if provider == job_provider else {}), **actual}
        for key, expected in (("provider", provider), ("tool", inbox.PROVIDERS[provider])):
            if key in metadata and metadata[key] != expected:
                raise ValueError(f"{sid} file {index}: generation {key} conflicts with provider")
        settings = {**processing, **overrides}
        cutter.processing_settings(sid, settings)
        path = pathlib.Path(entry["path"])
        path = (manifest.parent / path).resolve(strict=True) if not path.is_absolute() else path.resolve(strict=True)
        if not path.is_file() or path.suffix.lower() not in inbox.AUDIO_EXTENSIONS:
            raise ValueError(f"{sid} file {index}: expected an existing WAV or MP3")
        entries.append({"path": path, "provider": provider, "metadata": metadata, "processing": settings})
    return {"entries": entries, "selection": selection, "keep": keep}


def resume_family(sid: str, record: dict, inbox, cutter) -> None:
    """A failed runtime write can resume without importing or replacing the sources again."""
    sources = record["selected_sources"]
    expected = {entry["name"] for entry in sources}
    if {p.name for p in cutter.family_files(cutter.SRC, sid)} != expected:
        raise ValueError(f"{sid}: source set changed since placement; review installation audit")
    for entry in sources:
        path = cutter.SRC / entry["name"]
        sidecar = inbox.read_object(path.with_suffix(".json"))
        if (hashlib.sha256(path.read_bytes()).hexdigest() != entry["source_sha256"]
                or sidecar != entry["provenance"]):
            raise ValueError(f"{sid}: source/provenance changed since placement; review installation audit")
    cutter.install_family(sid, cutter.prepare_family(sid))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("session", type=pathlib.Path)
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--auto-select", action="store_true", help="rank by signal measurements instead of ear-selected positions")
    args = ap.parse_args()
    manifest = args.session.resolve(strict=True)
    inbox = load_script("sfx_inbox")
    cutter = load_script("sfx_cut")
    session = inbox.read_object(manifest)
    jobs = session.get("jobs")
    if not isinstance(jobs, dict) or not jobs:
        raise ValueError("session jobs must be a nonempty object keyed by sound ID")
    unknown = set(args.ids) - jobs.keys()
    if unknown:
        raise ValueError(f"IDs not in the session: {', '.join(sorted(unknown))}")
    audit_path = manifest.with_name(f"{manifest.stem}-installation.json")
    audit = inbox.read_object(audit_path) if audit_path.exists() else {}
    plans = {}
    # Validate every requested job before staging/replacing any family.
    for sid, job in jobs.items():
        if args.ids and sid not in args.ids:
            continue
        if sid in audit:
            status = audit[sid].get("status", "completed")  # Historical audits have no status.
            if status == "completed":
                print(f"{sid}: already installed according to this session's audit; skipped")
                continue
            if status != "sources_placed":
                raise ValueError(f"{sid}: unrecognized installation status {status}")
            inbox.valid_id(sid)
            if sid not in cutter.SOUNDS:
                raise ValueError(f"{sid}: no S1 finishing rule")
            plans[sid] = None
        else:
            plans[sid] = prepare_job(sid, job, session.get("provider"), manifest, args.auto_select, inbox, cutter)
    for sid, plan in plans.items():
        if plan is None:
            resume_family(sid, audit[sid], inbox, cutter)
            audit[sid]["status"] = "completed"
            inbox.write_object(audit_path, audit)
            continue
        paths = []
        for entry in plan["entries"]:
            paths.extend(inbox.import_takes(sid, [entry["path"]], provider=entry["provider"],
                                           metadata=entry["metadata"], processing=entry["processing"]))
        # Rank this session's downloads only, never unrelated candidates already in the inbox.
        digests = [hashlib.sha256(p.read_bytes()).hexdigest() for p in paths]
        if len(set(digests)) != len(paths):
            raise ValueError(f"{sid}: files must contain distinct audio takes")
        rows = [(index, p, inbox.measure(p)) for index, p in enumerate(paths, 1)]
        selection = plan["selection"]
        if selection is None:
            ranked = sorted(rows, key=lambda row: (len(row[2]["flags"]), row[2]["floor_db"]))
            selection = [index for index, _, _ in ranked[:plan["keep"]]]
        chosen_paths = [paths[index - 1] for index in selection]
        # Decode/cut all keepers before replacing any installed source or runtime audio.
        prepared = cutter.prepare_family(sid, chosen_paths)
        chosen = [p.stem.rsplit("-", 1)[1] for p in chosen_paths]
        sources = []
        installed = []
        for number, (p, y, start_ms) in enumerate(prepared, 1):
            destination = cutter.SRC / f"{sid}-{number:02d}{p.suffix}"
            provenance = inbox.read_object(p.with_suffix(".json"))
            sources.append({"name": destination.name, "source_sha256": provenance["source_sha256"],
                            "provenance": provenance})
            installed.append((destination, y, start_ms))
        record = {"status": "sources_placed", "selection_basis": "manifest selection" if plan["selection"] else "signal ranking",
                  "listening_approval": "not recorded", "selected_file_positions": selection,
                  "selected_inbox_takes": chosen, "selected_sources": sources,
                  "measurements": [{"file_position": index, "take": p.name, **m} for index, p, m in rows]}
        print(f"{sid}: selected file positions {', '.join(map(str, selection))}")
        inbox.place(sid, chosen, False)
        audit[sid] = record
        inbox.write_object(audit_path, audit)
        cutter.install_family(sid, installed)
        audit[sid]["status"] = "completed"
        inbox.write_object(audit_path, audit)


if __name__ == "__main__":
    main()
