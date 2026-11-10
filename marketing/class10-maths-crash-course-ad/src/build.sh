#!/usr/bin/env bash
# Mixes voice-over + music and muxes with the silent render. Run from the project folder:
#   bash src/build.sh <silent.mp4> <music.wav>
set -euo pipefail
V=${1:-silent.mp4}; M=${2:-music.wav}; VO=assets/voiceover.mp3; O=output; N=neuron-academy-class10-maths-ad
mkdir -p "$O"
ENC="-c:v libx264 -preset slow -crf 19 -maxrate 12M -bufsize 24M -pix_fmt yuv420p -profile:v high -r 30 -movflags +faststart -c:a aac -b:a 192k -ar 48000 -ac 2"
VOF="[1:a]loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000,pan=stereo|c0=c0|c1=c0,apad=whole_dur=64,asplit=2[vo][sc]"
# master 64 s: voice + ducked music
ffmpeg -y -loglevel error -i "$V" -i "$VO" -i "$M" -filter_complex \
 "$VOF;[2:a]aresample=48000,volume=0.30[m];[m][sc]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=350[md];[vo][md]amix=inputs=2:normalize=0,volume=-2.3dB,alimiter=limit=0.89[a]" \
 -map 0:v -map "[a]" -t 64 $ENC "$O/$N-64s.mp4"
# voice only (add your own licensed music)
ffmpeg -y -loglevel error -i "$V" -i "$VO" -filter_complex "$VOF;[sc]anullsink;[vo]volume=-2.3dB,alimiter=limit=0.89[a]" \
 -map 0:v -map "[a]" -t 64 $ENC "$O/$N-64s-no-music.mp4"
# 50 s cut: same film, time-compressed 1.28x
ffmpeg -y -loglevel error -i "$O/$N-64s.mp4" -filter_complex "[0:v]setpts=PTS/1.28[v];[0:a]atempo=1.28[a]" \
 -map "[v]" -map "[a]" -t 50 $ENC "$O/$N-50s.mp4"
