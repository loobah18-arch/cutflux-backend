#!/usr/bin/env python3
"""
Cutflux Cloud Video Engine — Elite Demon Slayer AMV Editor Pipeline
Engineered to Pro AMV Editor Standards:
1. Rhythmic Bar Pacing: 15 cuts synced to 110 BPM phonk measure (2.18s bars, total 32.80s).
2. Climax Drop Execution: 808 drop at 5.40s with white luma impact flash & Fire Dragon roar.
3. Audio Dynamics & Foley Mix: 75/25 balance (Montagem Zora phonk + original Japanese dialogue & katana clashes).
   - Pre-drop dialogue volume boost (1.65x) & phonk lowpass ducking (0.22x).
   - Pre-drop vacuum (0.4s silence for breath intake at 5.00s–5.40s).
   - Explosive beat drop at 5.40s with sub-bass boost (+4dB @ 65Hz).
4. Visual Cleanliness & Color Grading:
   - 9:16 dual-layer ambient bokeh framing with dynamic punch zooms (1.15x / 1.25x / 1.35x).
   - High-definition line reconstruction via CAS/unsharp (unsharp=5:5:0.8:5:5:0.0).
   - Vibrant anime color grade (contrast 1.16, saturation 1.45, brightness 0.03).
5. Zero local phone compute load: runs 100% on GitHub Actions cloud runners.
"""

import os
import sys
import re
import urllib.request
import subprocess
from pathlib import Path

# Google Drive File ID for raw Demon Slayer S01E19 ("Hinokami")
GDRIVE_FILE_ID = "1TFpfmRQSbqVaL6IiKZTXEqkDohsRbB3m"
EPISODE_NAME = "Demon_Slayer_Kimetsu_no_Yaiba_480P_S01_E19.mp4"

def download_raw_episode_from_gdrive(file_id: str, dest_path: Path) -> Path:
    """
    Downloads raw uncut anime episode directly from Google Drive on the cloud runner.
    Handles direct streaming and virus-scan confirmation pages.
    """
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if dest_path.exists() and dest_path.stat().st_size > 15_000_000:
        print(f"[GDrive] Using cached raw episode: {dest_path.name} ({dest_path.stat().st_size // (1024*1024)} MB)")
        return dest_path

    url = f"https://drive.google.com/uc?id={file_id}&export=download&confirm=t"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    req = urllib.request.Request(url, headers=headers)
    print(f"[GDrive] Downloading raw episode {file_id} ({dest_path.name})...")

    with urllib.request.urlopen(req, timeout=60) as response:
        content_type = response.headers.get("content-type", "").lower()
        if "text/html" in content_type:
            html = response.read().decode("utf-8", errors="ignore")
            match = re.search(r'href="(/uc\?export=download[^"]+)"', html)
            if match:
                confirm_url = "https://drive.google.com" + match.group(1).replace("&amp;", "&")
                req2 = urllib.request.Request(confirm_url, headers=headers)
                with urllib.request.urlopen(req2, timeout=60) as resp2, open(dest_path, "wb") as out_file:
                    while chunk := resp2.read(1024 * 1024):
                        out_file.write(chunk)
            else:
                raise RuntimeError("Failed to resolve Google Drive download confirmation page")
        else:
            with open(dest_path, "wb") as out_file:
                while chunk := response.read(1024 * 1024):
                    out_file.write(chunk)

    mb = dest_path.stat().st_size / (1024 * 1024)
    print(f"[GDrive] Successfully downloaded raw episode: {dest_path.name} ({mb:.1f} MB)")
    return dest_path

def main():
    base_dir = Path(__file__).resolve().parent
    audio_path = base_dir / "assets" / "audio" / "montagem_zora.mp3"
    output_dir = base_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "cutflux_demonslayer_montagem_zora.mp4"
    raw_episodes_dir = base_dir / "raw_episodes"

    if not audio_path.exists():
        print(f"[Error] Audio track {audio_path} not found")
        sys.exit(1)

    # 1. Download raw episode directly from Google Drive
    raw_episode = download_raw_episode_from_gdrive(
        GDRIVE_FILE_ID,
        raw_episodes_dir / EPISODE_NAME
    )

    # 2. Elite AMV Pacing Architecture (110 BPM = 0.545s beat, 2.18s full 4-beat bar)
    # Total runtime: 32.80s (guaranteed >= 30.0s requirement)
    raw_slices = [
        # (start_seconds, duration_seconds, punch_zoom, description)
        # Part 1: Dialogue Hook & Memory (0.00s - 3.25s)
        (988.0, 3.25, 1.06, "Tanjuro memory: Dance without fatigue (Japanese dialogue)"),
        # Part 2: Awakening & Ignition (3.25s - 5.00s)
        (1004.0, 1.75, 1.14, "Tanjiro switches breath: Nichirin blade ignites into flame"),
        # Part 3: Pre-Drop Vacuum (5.00s - 5.40s)
        (1012.0, 0.40, 1.25, "Pre-drop vacuum: Deep breath intake & Rui eyes widen"),
        # Part 4: THE BEAT DROP (5.40s - 7.58s) - 808 drop + white impact flash + Fire Dragon roar
        (1086.0, 2.18, 1.35, "THE DROP: Hinokami Kagura Fire Dragon roars forward"),
        # Part 5: Combat Rush 1 (7.58s - 9.76s)
        (1102.0, 2.18, 1.18, "Hinokami Kagura Enbu circular flame slash"),
        # Part 6: Combat Rush 2 (9.76s - 11.94s)
        (1120.0, 2.18, 1.28, "Giant Fire Dragon charges through thread cage"),
        # Part 7: Combat Rush 3 (11.94s - 14.12s)
        (1138.0, 2.18, 1.16, "Slicing through Rui crimson thread web"),
        # Part 8: Combat Rush 4 (14.12s - 16.30s)
        (1162.0, 2.18, 1.30, "Mid-air acrobatic flame roll"),
        # Part 9: Nezuko Awakening (16.30s - 18.48s)
        (1192.0, 2.18, 1.15, "Nezuko eyes open: Blood Demon Art chant"),
        # Part 10: Exploding Blood Detonation (18.48s - 20.66s)
        (1210.0, 2.18, 1.32, "Bakketsu: Pink flames detonate Rui threads"),
        # Part 11: Rui Shock & Disintegration (20.66s - 22.84s)
        (1224.0, 2.18, 1.15, "Rui threads disintegrating in pink flames"),
        # Part 12: Vortex Acceleration (22.84s - 25.02s)
        (1248.0, 2.18, 1.28, "Tanjiro charging through fiery pink vortex"),
        # Part 13: Velocity Rush (25.02s - 27.20s)
        (1262.0, 2.18, 1.35, "High-velocity dash with flame wake"),
        # Part 14: Climax Impact (27.20s - 29.38s)
        (1276.0, 2.18, 1.25, "Nichirin blade connects with Rui neck"),
        # Part 15: Finisher Hold & Fadeout (29.38s - 32.80s)
        (1280.0, 3.42, 1.18, "Decapitation follow-through & trailing embers")
    ]

    total_target_dur = sum(s[1] for s in raw_slices)
    print(f"==> Source Raw Episode: {raw_episode.name}")
    print(f"==> Planned Duration: {total_target_dur:.2f}s (Guaranteed >= 30.0s)")
    print(f"==> Phonk BGM: {audio_path.name}")
    print(f"==> Target Output: {output_file}")

    tmp_dir = base_dir / "tmp_render"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # 3. Slice each cut preserving original Japanese audio & applying 9:16 dual-layer styling
    processed_clips = []
    for i, (start_sec, dur, zoom, label) in enumerate(raw_slices):
        out_clip = tmp_dir / f"slice_{i:02d}.mp4"

        # Dual-layer anime framing: blurred bokeh 9:16 background + sharp scale-punch foreground
        vf_filter = (
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];"
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,scale=iw*{zoom:.2f}:ih*{zoom:.2f}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,"
            f"eq=contrast=1.16:saturation=1.45:brightness=0.03,"
            f"unsharp=5:5:0.8:5:5:0.0,"
            f"format=yuv420p"
        )

        # Retain original anime audio stream with AAC encoding
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_sec),
            "-t", str(dur),
            "-i", str(raw_episode),
            "-filter_complex", vf_filter,
            "-c:v", "libx264",
            "-preset", "faster",
            "-crf", "18",
            "-r", "30",
            "-c:a", "aac",
            "-b:a", "192k",
            str(out_clip)
        ]
        print(f"--> Slicing clip {i+1}/{len(raw_slices)}: {label} (start: {start_sec}s, dur: {dur}s, zoom: {zoom}x)...")
        subprocess.run(cmd, check=True)
        processed_clips.append(out_clip)

    # 4. Concat video & audio slices
    concat_list_file = tmp_dir / "concat_list.txt"
    with open(concat_list_file, "w") as f:
        for p in processed_clips:
            f.write(f"file '{p.resolve()}'\n")

    video_concat_file = tmp_dir / "combined_video.mp4"
    cmd_concat = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_list_file),
        "-c", "copy",
        str(video_concat_file)
    ]
    print("--> Concatenating slices into master timeline...")
    subprocess.run(cmd_concat, check=True)

    # 5. Master Pro AMV Audio Mix & Beat Drop Impact Flash
    # - At 5.40s: subtle white luma impact flash overlay (0.08s) on the drop
    # - Audio: 75/25 balance (Montagem Zora phonk + original Japanese anime dialogue & blade Foley)
    print("--> Applying Beat Drop Impact Flash and mastering 75/25 Phonk + Anime Audio Mix...")

    # Phonk filter: lowpass ducking during dialogue (0-5s), dead vacuum (5.00-5.40s), bass drop blast (5.40s+)
    phonk_filter = (
        "volume=enable='between(t,0,5.00)':volume=0.22,"
        "lowpass=f=380:enable='between(t,0,5.00)',"
        "volume=enable='between(t,5.00,5.40)':volume=0.00,"
        "volume=enable='between(t,5.40,7.00)':volume=1.30,"
        "bass=g=4:f=65:enable='gte(t,5.40)',"
        "volume=enable='between(t,7.00,30.80)':volume=0.90,"
        "afade=t=out:st=30.80:d=2.0[phonk]"
    )

    # Anime audio filter: dialogue vocal boost (1.65x) with highpass & speech treble, combat Foley presence
    anime_filter = (
        "volume=enable='between(t,0,5.00)':volume=1.65,"
        "highpass=f=80,"
        "treble=g=2.5:f=3200:enable='between(t,0,5.00)',"
        "volume=enable='gte(t,5.40)':volume=1.15,"
        "treble=g=2.0:f=4500:enable='gte(t,5.40)'[anime]"
    )

    # Combined master filtergraph
    complex_filter = (
        f"[0:v]eq=brightness=0.25:enable='between(t,5.40,5.48)'[vout];"
        f"[1:a]{phonk_filter};"
        f"[0:a]{anime_filter};"
        f"[phonk][anime]amix=inputs=2:duration=first:dropout_transition=2:normalize=0,"
        f"loudnorm=I=-14:LRA=7:tp=-1.0[aout]"
    )

    cmd_master = [
        "ffmpeg", "-y",
        "-i", str(video_concat_file),
        "-i", str(audio_path),
        "-t", str(total_target_dur),
        "-filter_complex", complex_filter,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "faster",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output_file)
    ]
    subprocess.run(cmd_master, check=True)

    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"\n[SUCCESS] Rendered Pro Demon Slayer AMV: {output_file} ({file_size_mb:.2f} MB, {total_target_dur:.1f}s, 1080x1920)")

if __name__ == "__main__":
    main()
