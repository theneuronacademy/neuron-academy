"""Fit a reel to its recorded voice-over.
Tightens pauses, drops listed non-speech sounds, speeds the voice just enough to finish under the
limit, then writes <reel>/src/reel-final.html whose seek() is warped so each cue lands on its word.
Usage: python3 tools/build_final.py <reel-dir> <voice.mp3> <work-dir>
Reads <reel-dir>/src/timing.json: {"drop":[[a,b],...], "anchors":[[design_s, original_audio_s],...], "design_end":39}
"""
import json, subprocess, sys, wave, re, os
import numpy as np
reel, voice, work = sys.argv[1:4]
cfg = json.load(open(f"{reel}/src/timing.json"))
GAP, PAD, LIMIT, TAIL, SR = 0.10, 0.03, 39.6, 0.45, 44100
raw = f"{work}/raw.wav"
subprocess.run(["ffmpeg","-y","-loglevel","error","-i",voice,"-ar",str(SR),"-ac","1",raw],check=True)
w = wave.open(raw); x = np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
n = len(x); win = int(.02*SR)
db = 20*np.log10(np.sqrt(np.convolve(x**2,np.ones(win)/win,'same'))+1e-6)
low = db < -38; sil = []; k = 0
while k < n:
    if low[k]:
        s = k
        while k < n and low[k]: k += 1
        if (k-s)/SR >= 0.2: sil.append((s/SR,k/SR))
    k += 1
pts = [0]+[v for a,b in sil for v in (a,b)]+[n/SR]
segs = [(pts[j],pts[j+1]) for j in range(0,len(pts),2) if pts[j+1]-pts[j] > 0.08]
segs = [(a,b) for a,b in segs if not any(a >= d0-0.05 and b <= d1+0.05 for d0,d1 in cfg["drop"])]
out = []; starts = []; pos = 0.0
for a,b in segs:
    a2, b2 = max(0,a-PAD), min(n/SR,b+PAD)
    c = x[int(a2*SR):int(b2*SR)].copy(); f = int(.008*SR)
    c[:f] *= np.linspace(0,1,f); c[-f:] *= np.linspace(1,0,f)
    starts.append((a2,pos)); out.append(c); pos += len(c)/SR
    g = np.zeros(int(GAP*SR),np.float32); out.append(g); pos += GAP
tight = np.concatenate(out[:-1]); tight_len = len(tight)/SR
tempo = max(1.0, (tight_len+TAIL)/LIMIT)
ww = wave.open(f"{work}/tight.wav","wb"); ww.setnchannels(1); ww.setsampwidth(2); ww.setframerate(SR)
ww.writeframes((np.clip(tight,-1,1)*32767).astype(np.int16).tobytes()); ww.close()
os.makedirs(f"{reel}/assets",exist_ok=True)
vo = f"{reel}/assets/voiceover-fitted.wav"
subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f"{work}/tight.wav","-af",f"atempo={tempo:.4f},loudnorm=I=-16:TP=-1.5:LRA=9","-ar","48000",vo],check=True)
total = round(tight_len/tempo + TAIL, 2)
def new_t(t):                       # original-audio time -> time in the fitted audio
    best = starts[0]
    for a,p in starts:
        if a <= t+0.06: best = (a,p)
    a,p = best; nxt = [q for (aa,q) in starts if q > p]
    v = p + max(0,t-a)
    if nxt: v = min(v, nxt[0]-GAP*0.5)
    return v/tempo
A = [[-0.05,-0.25]]+[[d,round(new_t(o),3)] for d,o in cfg["anchors"]]+[[cfg["design_end"],total]]
for (d0,t0),(d1,t1) in zip(A,A[1:]): assert d1 > d0 and t1 > t0, (d0,t0,d1,t1)
html = open(f"{reel}/src/reel.html").read()
inj = f"""<script>(()=>{{const A={json.dumps(A)},s0=window.seek;
window.seek=t=>{{let d=A[A.length-1][0];for(let i=1;i<A.length;i++){{if(t<=A[i][1]){{const[a,b]=[A[i-1],A[i]];d=a[0]+(b[0]-a[0])*(t-a[1])/(b[1]-a[1]);break}}}}s0(d)}};window.seek(0)}})();</script>"""
open(f"{reel}/src/reel-final.html","w").write(html.replace("</body>",inj+"</body>"))
# subtitles in real time, from the .sub cues in the page
def real(d):
    for (d0,t0),(d1,t1) in zip(A,A[1:]):
        if d <= d1: return t0+(t1-t0)*(d-d0)/(d1-d0)
    return total
def ts(v): return "%02d:%02d:%02d,%03d"%(v//3600,v%3600//60,v%60,round(v%1*1000)%1000)
cues = re.findall(r'<div class="sub" data-t="([\d.]+),([\d.]+)"[^>]*>(.*?)</div>',html)
with open(f"{reel}/subtitles-final.srt","w") as f:
    for i,(a,b,txt) in enumerate(cues,1):
        txt = re.sub(r"<br>","\n",txt); txt = re.sub(r"<[^>]+>","",txt)
        f.write(f"{i}\n{ts(real(float(a)))} --> {ts(real(float(b)))}\n{txt}\n\n")
print(json.dumps({"segments":len(segs),"tight":round(tight_len,2),"tempo":round(tempo,3),"total":total,"anchors":A}))
