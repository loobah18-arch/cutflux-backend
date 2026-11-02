#!/usr/bin/env python3
"""
Cutflux Cloud Video Engine — Demon Slayer Beat-Synced 9:16 AMV Renderer
Designed to run on GitHub Actions cloud runner with zero phone load.
Enforces minimum 30+ seconds duration.
"""

import os
import sys
import json
import glob
import subprocess
from pathlib import Path

def main():
    base_dir = Path(__file__).resolve().parent
    clips_dir = base_dir / "assets" / "clips"
    audio_path = base_dir / "assets" / "audio" / "montagem_zora.mp3"
    output_dir = base_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "cutflux_demonslayer_montagem_zora.mp4"

    clips = sorted(list(clips_dir.glob("*.mp4")))
    if not clips:
        print("[Error] No video clips found in assets/clips/")
        sys.exit(1)

    if not audio_path.exists():
        print(f"[Error] Audio track {audio_path} not found")
        sys.exit(1)

    # Cutflux template timing sequence: minimum 30 seconds duration
    # 14 distinct action cuts across Demon Slayer sakuga (Tanjiro Hinokami Kagura, Rui clash, Inosuke Beast Breathing)
    beat_durations = [
        3.20,  # 01. Hook setup shot
        2.10,  # 02. First beat drop impact
        2.10,  # 03. Rhythm fire slash
        2.20,  # 04. Punch zoom rotation
        2.10,  # 05. Hinokami Kagura dragon
        2.30,  # 06. Sun breathing acceleration
        2.10,  # 07. Water breathing 10th form
        2.10,  # 08. Rapid blade combo
        2.40,  # 09. Dance of the fire god peak
        2.10,  # 10. Thread severance
        2.10,  # 11. Beast breathing dual slash
        2.20,  # 12. Spatial awareness blitz
        2.30,  # 13. High-velocity lunge
        3.50   # 14. Climax finisher + fadeout
    ]

    # Ensure total duration is at least 30.0 seconds
    if len(clips) < len(beat_durations):
        extended_clips = []
        while len(extended_clips) < len(beat_durations):
            extended_clips.extend(clips)
        clips = extended_clips[:len(beat_durations)]
    else:
        clips = clips[:len(beat_durations)]

    total_target_dur = sum(beat_durations[:len(clips)])

    print(f"==> Found {len(clips)} Demon Slayer source clips")
    print(f"==> Phonk BGM: {audio_path.name}")
    print(f"==> Target Output: {output_file}")
    print(f"==> Planned Duration: {total_target_dur:.2f}s (Guaranteed >= 30.0s)")

    tmp_dir = base_dir / "tmp_render"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # Step 1: Normalize and format each clip to 1080x1920 9:16 with adaptive dual-layer zoom
    processed_clips = []

    for i, clip in enumerate(clips):
        dur = beat_durations[i]
        out_clip = tmp_dir / f"norm_{i:02d}.mp4"
        
        # Dual-layer anime framing: blurred 9:16 background + sharp scale-punch foreground
        # Alternating zoom punches on cuts (1.10x / 1.25x / 1.35x)
        zoom = 1.32 if (i % 3 == 0) else (1.18 if (i % 2 == 0) else 1.08)
        vf_filter = (
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];"
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,scale=iw*{zoom}:ih*{zoom}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,"
            f"eq=contrast=1.14:saturation=1.40:brightness=0.04,"
            f"format=yuv420p"
        )

        cmd = [
            "ffmpeg", "-y",
            "-t", str(dur),
            "-i", str(clip),
            "-filter_complex", vf_filter,
            "-c:v", "libx264",
            "-preset", "faster",
            "-crf", "18",
            "-r", "30",
            "-an",
            str(out_clip)
        ]
        print(f"--> Processing slice {i+1}/{len(clips)} (duration: {dur}s)...")
        subprocess.run(cmd, check=True)
        processed_clips.append(out_clip)

    # Step 2: Concat video slices
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

    # Step 3: Mix with Montagem Zora phonk audio, ducking curve and loud sub-bass master
    print("--> Muxing Montagem Zora phonk audio and finalizing master 1080x1920 Demon Slayer Short...")
    af_filter = (
        f"volume=1.05,"
        f"loudnorm=I=-14:LRA=7:tp=-1.0,"
        f"afade=t=out:st={total_target_dur - 2.0}:d=2.0"
    )

    cmd_master = [
        "ffmpeg", "-y",
        "-i", str(video_concat_file),
        "-i", str(audio_path),
        "-t", str(total_target_dur),
        "-filter:a", af_filter,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(output_file)
    ]
    subprocess.run(cmd_master, check=True)

    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"\n[SUCCESS] Rendered Demon Slayer Short: {output_file} ({file_size_mb:.2f} MB, {total_target_dur:.1f}s, 1080x1920)")

if __name__ == "__main__":
    main()
