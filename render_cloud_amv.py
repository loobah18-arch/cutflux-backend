#!/usr/bin/env python3
"""
Cutflux Cloud Video Engine — High-Energy Beat-Synced 9:16 AMV Renderer
Designed to run on GitHub Actions cloud runner with zero phone load.
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
    output_file = output_dir / "cutflux_jjk_montagem_zora.mp4"

    clips = sorted(list(clips_dir.glob("*.mp4")))
    if not clips:
        print("[Error] No video clips found in assets/clips/")
        sys.exit(1)

    if not audio_path.exists():
        print(f"[Error] Audio track {audio_path} not found")
        sys.exit(1)

    print(f"==> Found {len(clips)} source clips from DCIM/MovieBox")
    print(f"==> Phonk BGM: {audio_path.name}")
    print(f"==> Target Output: {output_file}")

    # Cutflux template timing specifications
    # Cut duration sequence in seconds (matching high-octane 110-128 BPM phonk beats)
    beat_durations = [3.20, 1.90, 1.90, 1.90, 3.80]
    total_target_dur = sum(beat_durations[:len(clips)])

    # Step 1: Normalize and format each clip to 1080x1920 9:16 with adaptive dual-layer zoom
    processed_clips = []
    tmp_dir = base_dir / "tmp_render"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    for i, clip in enumerate(clips):
        dur = beat_durations[i % len(beat_durations)]
        out_clip = tmp_dir / f"norm_{i:02d}.mp4"
        
        # Dual-layer anime framing: blurred 9:16 background + sharp scale-punch foreground
        # Alternating zoom punches on cuts (1.15x / 1.30x)
        zoom = 1.25 if (i % 2 == 1) else 1.10
        vf_filter = (
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];"
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,scale=iw*{zoom}:ih*{zoom}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,"
            f"eq=contrast=1.12:saturation=1.35:brightness=0.04,"
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
    print("--> Muxing Montagem Zora phonk audio and finalizing master 1080x1920 Short...")
    af_filter = (
        f"volume=1.05,"
        f"loudnorm=I=-14:LRA=7:tp=-1.0,"
        f"afade=t=out:st={total_target_dur - 1.5}:d=1.5"
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
    print(f"\n[SUCCESS] Rendered Short: {output_file} ({file_size_mb:.2f} MB, {total_target_dur:.1f}s, 1080x1920)")

if __name__ == "__main__":
    main()
