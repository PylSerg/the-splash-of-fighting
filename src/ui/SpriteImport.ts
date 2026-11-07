/** Player-selected sprite artwork stays on the current device.
 * Saving a Blob to IndexedDB avoids multi-megabyte localStorage strings.
 * Import remains opt-in, so no external asset server or API is required.
 */
export type EviSheetKind='combat'|'cinematic';
const DATABASE='splash-fighter-art-v1';
const STORE='sheets';

function openDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){
      reject(new Error('IndexedDB unavailable'));return;
    }
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('Sprite storage failed'));
  });
}

export async function storeEviSheet(kind:EviSheetKind,file:Blob):Promise<void>{
  const db=await openDatabase();
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put(file,kind);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error??new Error('Sprite save failed'));
      tx.onabort=()=>reject(tx.error??new Error('Sprite save cancelled'));
    });
  }finally{db.close();}
}

export async function readEviSheet(kind:EviSheetKind):Promise<Blob|null>{
  const db=await openDatabase();
  try{
    return await new Promise<Blob|null>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const request=tx.objectStore(STORE).get(kind);
      request.onsuccess=()=>resolve(request.result instanceof Blob?request.result:null);
      request.onerror=()=>reject(request.error??new Error('Sprite read failed'));
    });
  }finally{db.close();}
}

export async function clearEviSheets():Promise<void>{
  const db=await openDatabase();
  try{
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error??new Error('Could not remove sprite art'));
    });
  }finally{db.close();}
}

export async function loadImageFromBlob(blob:Blob):Promise<HTMLImageElement>{
  if(!blob.type.startsWith('image/'))
    throw new Error('Оберіть зображення PNG або WebP.');
  if(blob.size>10*1024*1024)
    throw new Error('Зображення завелике. Максимум 10 МБ.');
  const url=URL.createObjectURL(blob);
  try{
    return await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error('Не вдалося прочитати спрайт-лист.'));
      img.src=url;
    });
  }finally{URL.revokeObjectURL(url);}
}
