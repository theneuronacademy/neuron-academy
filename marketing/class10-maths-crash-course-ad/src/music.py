"""Original synthesized music bed + sound effects for the ad (no third-party audio, so no licence needed).
Usage: python3 music.py <out.wav>   -> 64 s, 44.1 kHz stereo"""
import numpy as np, wave, sys
SR=44100; T=64.0; N=int(SR*T); t=np.arange(N)/SR
L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(7)
BPM=100; beat=60/BPM; bar=4*beat
def hz(m): return 440*2**((m-69)/12)
def add(sig,start,pan=0.0,g=1.0):
    i=int(start*SR)
    if i>=N: return
    sig=sig[:N-i]; L[i:i+len(sig)]+=sig*g*(1-max(0,pan)); R[i:i+len(sig)]+=sig*g*(1+min(0,pan))
def env(n,a,r):
    e=np.ones(n); na=int(a*SR); nr=int(r*SR)
    e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
# C - G - Am - F, uplifting
CH=[[48,55,60,64,67],[43,55,59,62,67],[45,57,60,64,69],[41,53,57,60,65]]
nb=int(T/bar)+1
for b in range(nb):
    st=b*bar; ch=CH[b%4]; n=int(bar*SR*1.05); tt=np.arange(n)/SR
    # pad (soft, slightly detuned)
    pad=sum(np.sin(2*np.pi*hz(m)*d*tt)+0.3*np.sin(2*np.pi*hz(m)*2*d*tt) for m in ch[1:] for d in (0.997,1.003))
    lvl=0.030 if st<5.4 else 0.022
    add(pad*env(n,0.4,0.5),st,0,lvl)
    if st>=5.0:   # bass
        f=hz(ch[0]-12) ; bs=np.sin(2*np.pi*f*tt)+0.4*np.sin(2*np.pi*2*f*tt)
        for k in range(8 if st>=14.4 else 2):
            seg=int(beat/2*SR); e=np.exp(-np.arange(seg)/SR*5); add(bs[:seg]*e,st+k*(beat/2 if st>=14.4 else 2*beat),0,0.10)
    if st>=5.0:   # pluck arpeggio
        pat=[1,2,3,4,3,2,3,4]
        for k,p in enumerate(pat):
            f=hz(ch[p]+12); seg=int(0.5*SR); ts=np.arange(seg)/SR
            pl=(np.sin(2*np.pi*f*ts)+0.5*np.sin(2*np.pi*2*f*ts)+0.2*np.sin(2*np.pi*3*f*ts))*np.exp(-ts*9)
            add(pl,st+k*beat/2,(-1)**k*0.4,0.045); add(pl,st+k*beat/2+0.75*beat,-(-1)**k*0.5,0.015)
    if st>=14.4:  # drums
        for k in range(4):
            ts=np.arange(int(0.3*SR))/SR
            kick=np.sin(2*np.pi*(45*ts+ (110/28)*(1-np.exp(-ts*28))))*np.exp(-ts*11)
            add(kick,st+k*beat,0,0.30)
            hs=np.arange(int(0.05*SR))/SR; hat=rng.standard_normal(len(hs))*np.exp(-hs*90); hat=np.diff(hat,prepend=0)
            add(hat,st+k*beat+beat/2,0.2,0.035)
            if k in(1,3):
                cs=np.arange(int(0.18*SR))/SR; clap=rng.standard_normal(len(cs))*np.exp(-cs*28); clap=np.diff(clap,prepend=0)
                add(clap,st+k*beat,-0.1,0.05)
# ---- sound effects ----
def whoosh(at,d=0.7,g=0.10):
    n=int(d*SR); x=rng.standard_normal(n); k=np.ones(60)/60; x=np.convolve(x,k,'same')*8
    ts=np.arange(n)/SR; x*=np.sin(np.pi*ts/d)**2*np.sin(2*np.pi*(300+900*ts/d)*ts*0+1)
    add(x,at-d/2,-0.6,g*0.5); add(x,at-d/2+0.04,0.6,g*0.5)
def ping(at,m=84,g=0.06):
    ts=np.arange(int(0.6*SR))/SR; f=hz(m); add((np.sin(2*np.pi*f*ts)+0.4*np.sin(2*np.pi*2*f*ts))*np.exp(-ts*8),at,0.2,g)
def impact(at,g=0.5):
    ts=np.arange(int(1.4*SR))/SR
    add(np.sin(2*np.pi*(38*ts+(90/14)*(1-np.exp(-ts*14))))*np.exp(-ts*3.2),at,0,g)
    nz=rng.standard_normal(len(ts))*np.exp(-ts*6); nz=np.convolve(nz,np.ones(8)/8,'same'); add(nz,at,0,g*0.25)
def riser(at,d=1.6,g=0.06):
    n=int(d*SR); ts=np.arange(n)/SR; x=np.diff(rng.standard_normal(n),prepend=0)*(ts/d)**2.5; add(x,at-d,0,g)
    add(np.sin(2*np.pi*(300*ts+500*ts*ts/d/2*2))*(ts/d)**2,at-d,0,g*0.5)
def chime(at,g=0.07):
    for i,m in enumerate([72,76,79,84]): ping(at+i*0.07,m,g)
for c in [5.4,13.1,15.0,20.0,30.0,36.6,47.3,52.4]: whoosh(c)
for p in [20.4,22.6,24.4,25.9,28.3,29.0]: ping(p,84 if p<26 else 86,0.05)
impact(0.25,0.35); impact(13.15,0.4); chime(13.2)
riser(31.7,1.4); impact(31.7,0.4)
ping(40.7,60,0.10)            # strike-through
riser(42.3,1.6,0.08); impact(42.3,0.6); chime(42.35,0.09)   # price reveal
chime(45.2,0.09); impact(45.2,0.3)                          # save 1,000
chime(48.5,0.06); impact(51.1,0.3)
impact(52.5,0.55); chime(52.55,0.09)                        # brand reveal
chime(60.3,0.08)
# final sustained C major chord + fade
fo=np.ones(N); i0=int(61.0*SR); fo[i0:]=np.linspace(1,0,N-i0)**1.5
fi=np.ones(N); fi[:int(0.3*SR)]=np.linspace(0,1,int(0.3*SR))
L*=fo*fi; R*=fo*fi
m=max(abs(L).max(),abs(R).max()); L,R=np.tanh(L/m*1.3)*0.9,np.tanh(R/m*1.3)*0.9
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.stack([L,R],1)*32767).astype(np.int16).tobytes()); w.close()
