/** Animated, user-supplied Evi idle art for the character selector.
 * The six RGBA frames live in IndexedDB and are independent of gameplay.
 * Import accepts the ZIP from the chat or six individually edited PNGs.
 */
import JSZip from 'jszip';

export const EVI_IDLE_FRAMES=6;
export const EVI_IDLE_WIDTH=512;
export const EVI_IDLE_HEIGHT=768;
export const EVI_IDLE_FRAME_MS=185;
const MAX_ZIP_BYTES=12*1024*1024;
const MAX_FRAME_BYTES=5*1024*1024;

const key=(i:number)=>'idle_'+String(i+1).padStart(3,'0')+'.png';

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
    try {zip=await JSZip.loadAsync(file);}catch{
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
