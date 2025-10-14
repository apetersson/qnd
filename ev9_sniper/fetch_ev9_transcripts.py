#!/usr/bin/env python3
import argparse
import csv
import os
import re
import time
import glob
from datetime import datetime
from typing import Optional

import requests
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
)
from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig, ProxyConfig


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "kia-ev9-youtube-videos.csv")
OUT_DIR = os.path.join(SCRIPT_DIR, "ev9_review_transcripts")


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def sanitize_filename(name: str) -> str:
    # Remove characters that are problematic on most filesystems
    return re.sub(r'[\n\r\\/:*?"<>|]', "-", name).strip()


def fetch_watch_html(video_id: str) -> str:
    url = f"https://www.youtube.com/watch?v={video_id}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.text


def extract_date_published(html: str) -> Optional[str]:
    # Try itemprop meta
    m = re.search(r'itemprop="datePublished"\s+content="(\d{4}-\d{2}-\d{2})"', html)
    if m:
        return m.group(1)
    # Try JSON-LD pattern
    m = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"', html)
    if m:
        return m.group(1)
    return None


def secs_to_hhmmss(secs: float) -> str:
    total = int(round(secs))
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def fetch_transcript_segments(
    video_id: str,
    prefer_langs: list[str] | None = None,
    translate_to: Optional[str] = None,
    proxy_config: Optional[ProxyConfig] = None,
):
    """Fetch transcript segments with robust language and translation fallbacks.

    Strategy:
      1) Try preferred languages (manual or generated) in order.
      2) Try listing transcripts and picking best match:
         - exact language match (manual > generated)
         - otherwise any transcript that can translate to `translate_to`
         - otherwise first available transcript
    """
    prefer_langs = prefer_langs or [
        "en",
        "en-US",
        "en-GB",
        "en-AU",
        "de",
        "de-DE",
    ]

    api = YouTubeTranscriptApi(proxy_config=proxy_config)

    # Phase 1: quick path using API convenience for language list
    for lang in prefer_langs:
        try:
            fetched = api.fetch(video_id, languages=[lang])
            # Convert to list-of-dicts for backward compatibility with builder
            return fetched.to_raw_data()
        except (NoTranscriptFound, TranscriptsDisabled):
            continue

    # Phase 2: use full listing for smarter selection
    try:
        listing = api.list(video_id)
    except (NoTranscriptFound, TranscriptsDisabled):
        return None
    except Exception:
        # Network/other failure
        return None

    # Prefer exact language match in preferred order (manual first)
    for lang in prefer_langs:
        try:
            tr = listing.find_transcript([lang])
            # If multiple exist internally, library prioritises manual over generated
            return tr.fetch().to_raw_data()
        except Exception:
            pass

    # Look for any transcript that can be translated to target
    if translate_to:
        for tr in listing:
            try:
                codes = {getattr(tl, "language_code", "") for tl in (tr.translation_languages or [])}
                if translate_to in codes:
                    return tr.translate(translate_to).fetch().to_raw_data()
            except Exception:
                continue

    # Fallback: prefer EN/DE generated, then any
    generated_candidates = []
    others = []
    try:
        for tr in listing:
            try:
                if getattr(tr, "is_generated", False):
                    generated_candidates.append(tr)
                else:
                    others.append(tr)
            except Exception:
                continue
    except Exception:
        pass

    # Prefer generated EN/DE
    for tr in generated_candidates:
        try:
            code = getattr(tr, "language_code", "")
            if code.startswith("en") or code.startswith("de"):
                return tr.fetch().to_raw_data()
        except Exception:
            continue

    # Then any manual transcript
    for tr in others:
        try:
            return tr.fetch().to_raw_data()
        except Exception:
            continue

    # Finally, any generated transcript
    for tr in generated_candidates:
        try:
            return tr.fetch().to_raw_data()
        except Exception:
            continue

    return None


def build_transcript_text(segments: list[dict]) -> str:
    lines = []
    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue
        ts = secs_to_hhmmss(seg.get("start", 0))
        lines.append(f"[{ts}] {text}")
    return "\n".join(lines).strip() + "\n"


def fetch_transcript_via_searchapi(
    video_id: str,
    api_key: str,
    lang: Optional[str] = None,
    transcript_type: Optional[str] = None,
    timeout: int = 45,
):
    """Fetch transcript via SearchAPI.io YouTube Transcripts engine.

    Returns list of segments as dicts: {text, start, duration}, or None.
    """
    base_url = "https://www.searchapi.io/api/v1/search"
    params: dict[str, str] = {
        "engine": "youtube_transcripts",
        "video_id": video_id,
    }
    if lang:
        params["lang"] = lang
    if transcript_type:
        params["transcript_type"] = transcript_type

    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.get(base_url, params=params, headers=headers, timeout=timeout)
    if resp.status_code != 200:
        # Emit a short diagnostic to console but avoid dumping full body
        try:
            snippet = resp.text[:200]
        except Exception:
            snippet = "<no body>"
        print(f"  ! SearchAPI HTTP {resp.status_code}: {snippet}")
        return None

    try:
        data = resp.json()
    except Exception as e:
        print(f"  ! SearchAPI JSON parse error: {e}")
        return None

    transcripts = data.get("transcripts")
    if isinstance(transcripts, list) and transcripts:
        # Ensure expected keys exist
        segs = []
        for t in transcripts:
            if not isinstance(t, dict):
                continue
            segs.append({
                "text": t.get("text", ""),
                "start": float(t.get("start", 0) or 0),
                "duration": float(t.get("duration", 0) or 0),
            })
        return segs if segs else None

    # Look for message about available_languages
    if data.get("available_languages"):
        langs = ", ".join([str(x.get("lang")) for x in data["available_languages"] if isinstance(x, dict)])
        print(f"  - SearchAPI: transcript not in requested language. Available: {langs}")

    return None


def parse_args():
    p = argparse.ArgumentParser(description="Fetch YouTube transcripts for EV9 videos")
    p.add_argument("--csv", default=CSV_PATH, help="Path to CSV with columns id,title,channel,link")
    p.add_argument("--out", default=OUT_DIR, help="Output directory for .txt transcripts")
    p.add_argument("--limit", type=int, default=None, help="Only process the first N rows")
    p.add_argument(
        "--ids",
        default=None,
        help="Comma-separated list of video IDs to process (filters CSV)",
    )
    p.add_argument(
        "--translate-to",
        default=None,
        help="If set, translate transcript to this language code when possible (e.g. en)",
    )
    p.add_argument(
        "--prefer-langs",
        default="en,en-US,en-GB,en-AU,de,de-DE",
        help="Comma-separated preferred language codes in priority order",
    )
    p.add_argument("--delay", type=float, default=1.0, help="Delay in seconds between requests")
    p.add_argument("--overwrite", action="store_true", help="Always overwrite existing files")
    p.add_argument(
        "--skip-missing",
        action="store_true",
        help="Do not write a file if transcript is unavailable",
    )
    p.add_argument("--resume", action="store_true", help="Restartable mode: skip files that already have transcript; re-try those with 'Transcript not available.'")
    p.add_argument("--car-filter", default=None, help="Only process rows where car column equals this value (e.g. EV9 or IONIQ 9)")
    # Status/report options (to avoid external heredocs)
    p.add_argument("--report-status", action="store_true", help="Only report summary of existing/missing transcripts and exit")
    p.add_argument("--auto-missing", action="store_true", help="Automatically select only missing/empty transcripts from CSV")
    # Proxy options
    p.add_argument("--proxy-http", default=None, help="HTTP proxy URL (for GenericProxyConfig)")
    p.add_argument("--proxy-https", default=None, help="HTTPS proxy URL (for GenericProxyConfig)")
    p.add_argument("--webshare-user", default=None, help="Webshare proxy username")
    p.add_argument("--webshare-pass", default=None, help="Webshare proxy password")
    # SearchAPI fallback
    p.add_argument(
        "--searchapi-key",
        default=os.environ.get("SEARCHAPI_API_KEY"),
        help="SearchAPI.io API key for fallback when youtube-transcript-api fails (or IP blocked)",
    )
    p.add_argument(
        "--searchapi-lang",
        default=None,
        help="Optional language code for SearchAPI (e.g. en, de). If omitted, SearchAPI default is used",
    )
    p.add_argument(
        "--searchapi-type",
        default=None,
        choices=["auto", "manual"],
        help="Optional transcript_type preference for SearchAPI (auto or manual)",
    )
    p.add_argument(
        "--searchapi-only",
        action="store_true",
        help="Use SearchAPI only (skip direct youtube-transcript-api attempts)",
    )
    return p.parse_args()


def build_proxy_config(args: argparse.Namespace) -> Optional[ProxyConfig]:
    if args.webshare_user and args.webshare_pass:
        return WebshareProxyConfig(proxy_username=args.webshare_user, proxy_password=args.webshare_pass)
    if args.proxy_http or args.proxy_https:
        return GenericProxyConfig(http_url=args.proxy_http, https_url=args.proxy_https)
    return None


def main():
    args = parse_args()

    out_dir = os.path.abspath(args.out)
    ensure_dir(out_dir)

    csv_path = os.path.abspath(args.csv)
    if not os.path.exists(csv_path):
        raise SystemExit(f"CSV not found: {csv_path}")

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Skip comment/invalid rows (allow inline comments in CSV)
    clean_rows = []
    for r in rows:
        vid = (r.get("id") or "").strip()
        if not vid or vid.startswith("#"):
            continue
        clean_rows.append(r)
    rows = clean_rows

    # Optional car filter
    if args.car_filter:
        rows = [r for r in rows if (r.get("car") or "").strip().lower() == args.car_filter.strip().lower()]

    # Optional filter by --ids
    id_filter: set[str] | None = None
    if args.ids:
        id_filter = {s.strip() for s in args.ids.split(",") if s.strip()}
        rows = [r for r in rows if r.get("id", "").strip() in id_filter]

    # Optional limit
    if args.limit is not None:
        rows = rows[: args.limit]

    prefer_langs = [s.strip() for s in args.prefer_langs.split(",") if s.strip()]

    proxy_cfg = build_proxy_config(args)

    # Helper: compute status from existing files
    def compute_status(ids: list[str]):
        found_ids = set()
        missing_text_ids = set()
        for path in glob.glob(os.path.join(os.path.abspath(args.out), "*.txt")):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    head = f.read()
                m = re.search(r"^Video ID:\s*(\S+)", head, re.M)
                if m:
                    vid = m.group(1).strip()
                    found_ids.add(vid)
                    if "Transcript not available." in head:
                        missing_text_ids.add(vid)
            except Exception:
                continue
        no_file_ids = [vid for vid in ids if vid not in found_ids]
        missing_ids = list(dict.fromkeys(no_file_ids + list(missing_text_ids)))
        return found_ids, no_file_ids, missing_text_ids, missing_ids

    # If reporting or auto-missing selection is requested, compute and optionally filter rows
    csv_ids = [(r.get("id") or "").strip() for r in rows if (r.get("id") or "").strip()]
    if args.report_status or (args.auto_missing and not args.ids):
        found_ids, no_file_ids, missing_text_ids, missing_ids = compute_status(csv_ids)
        print(f"TOTAL IN CSV: {len(csv_ids)}")
        print(f"FOUND FILES: {len(found_ids)}")
        print(f"NO FILE: {len(no_file_ids)}")
        print(f"MISSING TEXT: {len(missing_text_ids)}")
        print(f"UNIQUE MISSING TOTAL: {len(missing_ids)}")
        if args.report_status and not args.auto_missing:
            return
        # auto-missing: filter rows down to the missing ids
        missing_set = set(missing_ids)
        rows = [r for r in rows if (r.get("id") or "").strip() in missing_set]
        if not rows:
            print("Nothing to do (no missing transcripts).")
            return

    for idx, row in enumerate(rows, start=1):
        video_id = row["id"].strip()
        title = row["title"].strip()
        channel = row["channel"].strip()
        url = row.get("link") or f"https://www.youtube.com/watch?v={video_id}"

        print(f"[{idx}/{len(rows)}] Processing {video_id} - {title}")

        # Fetch datePublished from page HTML
        date_str = None
        try:
            html = fetch_watch_html(video_id)
            date_str = extract_date_published(html)
        except Exception as e:
            print(f"  ! Failed to fetch HTML/date: {e}")

        # Fallback date
        if not date_str:
            date_str = datetime.now().strftime("%Y-%m-%d")

        # Fetch transcript (primary path or SearchAPI-only)
        transcript_text = None
        used_lang = None
        if not args.searchapi_only:
            try:
                segs = fetch_transcript_segments(
                    video_id,
                    prefer_langs=prefer_langs,
                    translate_to=args.translate_to,
                    proxy_config=proxy_cfg,
                )
                if segs:
                    transcript_text = build_transcript_text(segs)
            except Exception as e:
                print(f"  ! Failed to fetch transcript: {e}")

        # Fallback: use SearchAPI if primary path failed and key is available
        if (args.searchapi_only or not transcript_text) and args.searchapi_key:
            try:
                sa_segs = fetch_transcript_via_searchapi(
                    video_id,
                    api_key=args.searchapi_key,
                    lang=args.searchapi_lang,
                    transcript_type=args.searchapi_type,
                )
                if sa_segs:
                    transcript_text = build_transcript_text(sa_segs)
                    print("  - Fallback via SearchAPI succeeded")
                else:
                    print("  - SearchAPI fallback returned no transcript")
            except Exception as e:
                print(f"  ! SearchAPI fallback error: {e}")

        # Prepare filename
        filename = f"{date_str} - {sanitize_filename(channel)} - {sanitize_filename(title)}.txt"
        out_path = os.path.join(out_dir, filename)

        # Restartable behavior and write control
        write_file = True
        if os.path.exists(out_path) and not args.overwrite:
            # If resume, only rewrite when previous attempt had no transcript
            if args.resume:
                try:
                    with open(out_path, "r", encoding="utf-8") as existing:
                        content_head = existing.read(1000)
                    if "Transcript not available." in content_head and transcript_text:
                        write_file = True
                        print("  - Rewriting previous missing transcript")
                    else:
                        write_file = False
                        print("  - Skipping (already exists)")
                except Exception:
                    # If cannot read, allow rewriting
                    write_file = True
            else:
                write_file = False
                print("  - Skipping (file exists, use --overwrite or --resume)")

        if write_file:
            if transcript_text or not args.skip_missing:
                with open(out_path, "w", encoding="utf-8") as out:
                    header = [
                        f"Title: {title}",
                        f"Channel: {channel}",
                        f"Video ID: {video_id}",
                        f"URL: {url}",
                        f"Published: {date_str}",
                        "",
                    ]
                    out.write("\n".join(header))
                    if transcript_text:
                        out.write(transcript_text)
                    else:
                        out.write("Transcript not available.\n")
            else:
                print("  - Skipping file write due to missing transcript and --skip-missing")

        # be polite to YouTube
        time.sleep(max(0.0, float(args.delay)))

    print(f"Done. Files written to: {out_dir}")


if __name__ == "__main__":
    main()
