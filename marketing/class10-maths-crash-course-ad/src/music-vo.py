"""Original synthesized music bed + sound effects for the voice-timed 47.5 s cinematic cut (no third-party audio, so no licence needed).
Usage: python3 music.py <out.wav>   -> 47.5 s, 44.1 kHz stereo"""
import numpy as np, wave, sys
SR=44100; T=47.5; N=int(SR*T); t=np.arange(N)/SR
L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(7)
BPM=60/0.525; beat=60/BPM; bar=4*beat
def hz(m): return 440*2**((m-69)/12)
def add(sig,start,pan=0.0,g=1.0):
    i=int(start*SR)
    if i>=N: return
    sig=sig[:N-i]; L[i:i+len(sig)]+=sig*g*(1-max(0,pan)); R[i:i+len(sig)]+=sig*g*(1+min(0,pan))
def env(n,a,r):
    e=np.ones(n); na=int(a*SR); nr=int(r*SR)
    e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
# Am - F - C - G: tense opening that lifts at the brand reveal (9.05 s)
CH=[[45,57,60,64,69],[41,53,57,60,65],[48,55,60,64,67],[43,55,59,62,67]]
DROP=9.05; OFF=0.65; nb=int(T/bar)+2
for b in range(nb):
    st=OFF+(b-1)*bar; ch=CH[(b-1)%4]
    if st<0: st=0.0
    n=int(bar*SR*1.05); tt=np.arange(n)/SR
    quiet = 25.8<=st<32.1      # pull back before the price reveal
    pad=sum(np.sin(2*np.pi*hz(m)*d*tt)+0.3*np.sin(2*np.pi*hz(m)*2*d*tt) for m in ch[1:] for d in (0.997,1.003))
    add(pad*env(n,0.4,0.5),st,0,0.034 if st<DROP-0.01 else 0.022)
    if st<DROP-0.01:                # low drone + sparse piano-like notes
        dr=np.sin(2*np.pi*hz(33)*tt)+0.5*np.sin(2*np.pi*hz(45)*tt); add(dr*env(n,0.5,0.5),st,0,0.05)
        for k,p in enumerate([4,2] if st<4.8 else [4,3,2,3]):
            f=hz(ch[p]+12); seg=int(1.2*SR); ts=np.arange(seg)/SR
            add((np.sin(2*np.pi*f*ts)+0.4*np.sin(2*np.pi*2*f*ts))*np.exp(-ts*3.5),st+k*(2*beat if st<4.8 else beat),0.2*(-1)**k,0.07)
    if st>=DROP-0.01:
        f=hz(ch[0]-12); bs=np.sin(2*np.pi*f*tt)+0.4*np.sin(2*np.pi*2*f*tt)
        for k in range(2 if quiet else 8):
            seg=int(beat/2*SR); e=np.exp(-np.arange(seg)/SR*5); add(bs[:seg]*e,st+k*(2*beat if quiet else beat/2),0,0.10)
        pat=[1,2,3,4,3,2,3,4]
        for k,p in enumerate(pat):
            f=hz(ch[p]+12); seg=int(0.5*SR); ts=np.arange(seg)/SR
            pl=(np.sin(2*np.pi*f*ts)+0.5*np.sin(2*np.pi*2*f*ts)+0.2*np.sin(2*np.pi*3*f*ts))*np.exp(-ts*9)
            add(pl,st+k*beat/2,(-1)**k*0.4,0.045*(0.5 if quiet else 1)); add(pl,st+k*beat/2+0.75*beat,-(-1)**k*0.5,0.015)
        if not quiet and st<40.5:
            for k in range(4):
                ts=np.arange(int(0.3*SR))/SR
                kick=np.sin(2*np.pi*(45*ts+(110/28)*(1-np.exp(-ts*28))))*np.exp(-ts*11)
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
def tick(at,g=0.16):
    ts=np.arange(int(0.05*SR))/SR; x=np.sin(2*np.pi*2100*ts)*np.exp(-ts*160)+0.5*np.sin(2*np.pi*900*ts)*np.exp(-ts*90); add(x,at,0.1,g)
def pop(at,g=0.10):
    ts=np.arange(int(0.12*SR))/SR; add(np.sin(2*np.pi*(500+2500*ts)*ts)*np.exp(-ts*30),at,0,g)
for s_ in range(0,8): tick(float(s_)); tick(s_+0.5,0.05)        # clock, stops at the turn
impact(0.0,0.45)
for a,g in [(3.95,0.3),(4.8,0.3),(5.7,0.4)]: impact(a,g)        # FORMULAS / QUESTIONS / TIME
whoosh(7.2,0.9,0.12); riser(9.05,1.3,0.09)
impact(9.05,0.65); chime(9.1,0.10)                              # brand reveal
for c_ in [13.1,14.8,16.6,19.4,25.45,34.75,37.15]: whoosh(c_)
for p_ in [13.25,14.95,16.75]: ping(p_,84,0.06)                 # feature headlines
ping(18.3,84,0.07); ping(18.42,88,0.07)                         # doubt resolved
for i_,p_ in enumerate([19.7,21.2,22.7]): ping(p_,81+i_*2,0.06) # benefit ticks
impact(25.9,0.35)                                               # "special offer"
impact(28.3,0.22); whoosh(30.85,0.35,0.14)                      # regular fee, strike-through
riser(32.15,1.3,0.10); impact(32.15,0.75); chime(32.2,0.11)     # price reveal
chime(33.5,0.06)
impact(35.0,0.35)                                               # date stamp
pop(37.3)
for a in (38.4,39.6,40.6): tick(a,0.2); impact(a,0.22)          # number groups
impact(42.0,0.6); chime(42.05,0.10)                             # final brand reveal
n=int(5.4*SR); tt=np.arange(n)/SR
add(sum(np.sin(2*np.pi*hz(m)*tt) for m in [48,55,60,64,67,72])*env(n,0.05,3.0),42.0,0,0.035)
fo=np.ones(N); i0=int(45.5*SR); fo[i0:]=np.linspace(1,0,N-i0)**1.5
fi=np.ones(N); fi[:int(0.02*SR)]=np.linspace(0,1,int(0.02*SR))
L*=fo*fi; R*=fo*fi
m=max(abs(L).max(),abs(R).max()); L,R=np.tanh(L/m*1.3)*0.9,np.tanh(R/m*1.3)*0.9
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.stack([L,R],1)*32767).astype(np.int16).tobytes()); w.close()
