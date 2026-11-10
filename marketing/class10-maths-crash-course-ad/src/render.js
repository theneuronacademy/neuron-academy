// Renders ad.html frame-by-frame (1080x1920, 30 fps) and pipes frames to ffmpeg.
// Usage: node render.js <out-silent.mp4>
const {chromium}=require('playwright');const path=require('path');const {spawn}=require('child_process');
const FPS=30,DUR=64;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+path.resolve(__dirname,'ad.html'));await p.evaluate(()=>document.fonts.ready);
const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','15','-pix_fmt','yuv420p','-r',String(FPS),process.argv[2]],{stdio:['pipe','inherit','inherit']});
for(let f=0;f<FPS*DUR;f++){await p.evaluate(t=>seek(t),f/FPS);const buf=await p.screenshot({type:'jpeg',quality:95});
 if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(f%300==0)console.log('frame',f);}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done')})().catch(e=>{console.error(e);process.exit(1)});
