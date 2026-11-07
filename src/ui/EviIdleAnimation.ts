/** Animated, user-supplied Evi idle art for the character selector.
 * The six RGBA frames live in IndexedDB and are independent of gameplay.
 * Import accepts the ZIP from the chat or six individually edited PNGs.
 */
import JSZip from 'jszip';

export const EVI_IDLE_FRAMES=6;
export const EVI_IDLE_WIDTH=512;
export const EVI_IDLE_HEIGHT=768;
export const EVI_IDLE_FRAME_MS=185;

/** Back-and-forth idle playback: 0→1→…→last→…→1→0.
 * Return the next direction at both endpoints so neither endpoint gets
 * duplicated and the last-to-first jump is never rendered.
 * Pure on purpose: the selection controller and regression tests share
 * exactly the same stepping rules.
 */
export function advanceEviIdleFrame(
  frame:number,direction:1|-1,count=EVI_IDLE_FRAMES,
):{frame:number;direction:1|-1}{
  if(count<=1)return {frame:0,direction:1};
  const current=Math.max(0,Math.min(count-1,Math.trunc(frame)));
  const next=current+direction;
  if(next>=count)return {frame:count-2,direction:-1};
  if(next<0)return {frame:1,direction:1};
  return {
    frame:next,
    direction:next===count-1?-1:next===0?1:direction,
  };
}
const MAX_ZIP_BYTES=12*1024*1024;
const MAX_FRAME_BYTES=5*1024*1024;

const key=(i:number)=>'idle_'+String(i+1).padStart(3,'0')+'.png';

/** Vite BASE_URL works in development AND on GitHub Pages' subdirectory.
 * These six original RGBA PNGs ship with the game, so no manual ZIP import
 * is necessary. Importing edited frames is still supported as an override.
 */
export function bundledEviIdleUrls(baseUrl:string):string[]{
  const prefix=baseUrl.endsWith('/')?baseUrl:baseUrl+'/';
  return Array.from({length:EVI_IDLE_FRAMES},(_,i)=>
    prefix+'assets/evi/idle/'+key(i));
}

export async function loadBundledEviIdleFrames(baseUrl:string):Promise<Blob[]>{
  const urls=bundledEviIdleUrls(baseUrl);
  return Promise.all(urls.map(async (url,i)=>{
    const response=await fetch(url);
    if(!response.ok)throw new Error('Не вдалося завантажити '+key(i)+'.');
    return pngFrame(await response.blob(),key(i));
  }));
}

async function pngFrame(blob:Blob,name:string):Promise<Blob>{
  if(blob.size<33||blob.size>MAX_FRAME_BYTES)
    throw new Error(name+': некоректний розмір PNG.');
  const bytes=new Uint8Array(await blob.slice(0,33).arrayBuffer());
  const signature=[137,80,78,71,13,10,26,10];
  if(!signature.every((v,i)=>bytes[i]===v))
    throw new Error(name+': потрібен файл PNG.');
  const dv=new DataView(bytes.buffer);
  const width=dv.getUint32(16),height=dv.getUint32(20);
  // PNG color type 6 is RGBA, type 4 is grayscale with alpha.
  if(width!==EVI_IDLE_WIDTH||height!==EVI_IDLE_HEIGHT)
    throw new Error(name+': полотно має бути 512 × 768 px.');
  if(bytes[25]!==6)
    throw new Error(name+': потрібен PNG RGBA із альфа-каналом.');
  return blob.type==='image/png'?blob:new Blob([blob],{type:'image/png'});
}

/** Each import must supply exactly six ordered frames, not a merged atlas. */
export async function parseEviIdleFiles(files:FileList|File[]):Promise<Blob[]>{
  const entries=Array.from(files);
  if(entries.length===1 && /\.zip$/i.test(entries[0].name)){
    const file=entries[0];
    if(file.size>MAX_ZIP_BYTES)
      throw new Error('ZIP завеликий. Максимум 12 МБ.');
    let zip:JSZip;
    try {zip=await JSZip.loadAsync(await file.arrayBuffer());}catch{
      throw new Error('Не вдалося прочитати ZIP з кадрами Еві.');
    }
    const images:Blob[]=[];
    for(let i=0;i<EVI_IDLE_FRAMES;i++){
      const name=key(i);
      // Allow ZIPs packed either at root or in the evi_idle_frames/ folder.
      const entry=Object.values(zip.files).find(f=>
        !f.dir && f.name.split('/').at(-1)?.toLowerCase()===name);
      if(!entry)throw new Error('У ZIP бракує '+name+'.');
      const bytes=await entry.async('uint8array');
      images.push(await pngFrame(new Blob([new Uint8Array(bytes)],{type:'image/png'}),name));
    }
    return images;
  }
  if(entries.length!==EVI_IDLE_FRAMES)
    throw new Error('Обери ZIP або рівно 6 PNG: idle_001.png … idle_006.png.');
  const images:Blob[]=[];
  for(let i=0;i<EVI_IDLE_FRAMES;i++){
    const name=key(i);
    const file=entries.find(f=>f.name.toLowerCase()===name);
    if(!file)throw new Error('Не знайдено '+name+'.');
    images.push(await pngFrame(file,name));
  }
  return images;
}

/** Store separately edited PNGs as the same canonical ZIP as imported packs. */
export async function packEviIdleFrames(frames:Blob[]):Promise<Blob>{
  if(frames.length!==EVI_IDLE_FRAMES)throw new Error('Потрібно шість кадрів.');
  const zip=new JSZip();
  for(let i=0;i<frames.length;i++)zip.file(key(i),frames[i]);
  return zip.generateAsync({type:'blob',compression:'DEFLATE',
    compressionOptions:{level:6}});
}

/** Warm browser image decoders before enabling the visible animation. */
export async function preloadEviIdle(frames:Blob[]):Promise<string[]>{
  if(frames.length!==EVI_IDLE_FRAMES)
    throw new Error('Для Idle потрібні всі шість кадрів.');
  const urls=frames.map(frame=>URL.createObjectURL(frame));
  try{
    await Promise.all(urls.map(src=>new Promise<void>((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>img.decode().then(resolve,reject);
      img.onerror=()=>reject(new Error('Не вдалося відкрити кадр Еві.'));
      img.src=src;
    })));
    return urls;
  }catch(error){
    urls.forEach(url=>URL.revokeObjectURL(url));
    throw error;
  }
}
