import type { FighterId } from '../combat/Fighter';

export interface CharacterInfo {
  id: FighterId;
  name: string;
  title: string;
  color: string;
  glow: string;
}

/** Add playable fighters here as new FighterId visuals become available. */
export const CHARACTERS: readonly CharacterInfo[] = [
  { id: 'evi', name: 'ЕВІ', title: 'Стиль і швидкість', color: '#f49bc8', glow: '#e8abff' },
  { id: 'nara', name: 'НАРА', title: 'Сила і натиск', color: '#69e5da', glow: '#9ba7ff' },
  { id: 'lyra', name: 'ЛІРА', title: 'Полум’я та точність', color: '#ffaf69', glow: '#ffdd93' },
];

export const getCharacter = (id: FighterId): CharacterInfo => {
  const character = CHARACTERS.find(item => item.id === id);
  if (!character) throw new Error('Unknown fighter: ' + id);
  return character;
};

/** Original stylized SVG headshots, used for both the roster and fight HUD. */
export function portraitSvg(id: FighterId): string {
  if (id === 'lyra') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Портрет Ліри">
      <defs>
        <linearGradient id="lyr-bg" x2="1" y2="1"><stop stop-color="#8b4c6a"/><stop offset="1" stop-color="#243858"/></linearGradient>
        <linearGradient id="lyr-hair" x2=".7" y2="1"><stop stop-color="#ffcf82"/><stop offset=".55" stop-color="#fb9857"/><stop offset="1" stop-color="#ca5a55"/></linearGradient>
      </defs>
      <rect width="120" height="120" rx="16" fill="url(#lyr-bg)"/>
      <circle cx="98" cy="29" r="31" fill="#ffb960" opacity=".19"/>
      <path d="M15 120Q16 90 42 85L81 86Q107 91 112 120Z" fill="#233650"/>
      <path d="M38 78Q15 44 34 21Q50 7 76 21Q95 32 84 66L94 83 74 91 47 93Z" fill="url(#lyr-hair)"/>
      <path d="M82 36Q111 42 114 65L101 73 92 58Z" fill="#d46653"/>
      <path d="M39 43Q42 28 61 29Q79 29 82 46L78 73Q71 89 60 88Q47 87 42 71Z" fill="#f0bca2"/>
      <path d="M35 43Q38 19 62 19Q82 16 87 42Q71 33 58 36Q46 43 35 43" fill="#ffbd79"/>
      <path d="M44 54 55 53M67 54 79 53" stroke="#5b3c53" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="60" r="2.5" fill="#a76b43"/><circle cx="73" cy="60" r="2.5" fill="#a76b43"/>
      <path d="M55 76Q61 78 68 74" stroke="#b36c73" stroke-width="3" fill="none"/>
      <path d="M30 120Q34 93 47 87L61 106 77 87Q90 93 101 120" fill="#263a59" stroke="#f6b377" stroke-width="2"/>
      <path d="M44 90 60 104 78 90" fill="none" stroke="#ffd997" stroke-width="4"/>
      <circle cx="61" cy="110" r="6" fill="#ffcb75"/>
    </svg>`;
  }
  if (id === 'evi') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Портрет Еві">
      <defs>
        <linearGradient id="bg-evi" x2="1" y2="1"><stop stop-color="#5f3c8e"/><stop offset="1" stop-color="#233857"/></linearGradient>
        <linearGradient id="hair-evi" x2="0" y2="1"><stop stop-color="#ffe7a3"/><stop offset="1" stop-color="#e6ac79"/></linearGradient>
      </defs>
      <rect width="120" height="120" rx="16" fill="url(#bg-evi)"/>
      <path d="M0 101 38 82 81 86 120 105 120 120H0" fill="#f3bed5"/>
      <path d="M33 80Q22 39 41 21Q59 7 80 25Q96 44 86 86L70 91 45 90Z" fill="url(#hair-evi)"/>
      <path d="M41 45Q44 29 62 29Q81 29 82 49L80 72Q72 89 61 89Q48 87 41 71Z" fill="#edc6a6"/>
      <path d="M39 44Q42 24 58 21Q77 19 84 40Q72 31 60 34Q49 45 39 44" fill="#ffe7a3"/>
      <path d="M35 42Q33 59 41 73L34 83Q27 55 35 42M85 40Q93 62 84 83L76 76Q83 56 85 40" fill="#f0c58a"/>
      <path d="M40 55Q50 50 58 55L58 65Q50 71 41 64ZM64 55Q73 50 81 55L80 65Q72 70 64 64Z" fill="#263f60" fill-opacity=".20" stroke="#253951" stroke-width="3.5"/>
      <path d="M58 59H64M38 58 33 56M81 58 87 56" stroke="#253951" stroke-width="3"/>
      <circle cx="50" cy="60" r="2.4" fill="#3973aa"/><circle cx="73" cy="60" r="2.4" fill="#3973aa"/>
      <path d="M55 76Q61 79 68 75" stroke="#b56576" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M49 90 61 104 73 90" fill="#fff5ed"/>
      <path d="M25 120Q29 97 46 90L60 111 75 90Q94 97 98 120" fill="#fff0ee"/>
      <path d="M45 90 59 105 75 90" fill="none" stroke="#c88baf" stroke-width="3"/>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Портрет Нари">
    <defs>
      <linearGradient id="bg-nara" x2="1" y2="1"><stop stop-color="#31578c"/><stop offset="1" stop-color="#392545"/></linearGradient>
      <linearGradient id="hair-nara" x2="0" y2="1"><stop stop-color="#96fff2"/><stop offset="1" stop-color="#26b7b9"/></linearGradient>
    </defs>
    <rect width="120" height="120" rx="16" fill="url(#bg-nara)"/>
    <path d="M0 115Q19 81 54 85L86 82Q109 89 120 120H0" fill="#292337"/>
    <path d="M20 45Q8 24 29 15Q49 7 61 19Q73 9 86 24Q105 28 97 47Q112 47 113 59Q102 69 89 61L79 83 38 77Z" fill="url(#hair-nara)"/>
    <path d="M34 50Q39 33 59 33Q83 32 86 54L81 76Q72 89 60 89Q44 88 37 71Z" fill="#c5a3a4"/>
    <path d="M33 44Q45 20 66 27Q87 22 99 43L87 50Q75 41 58 42Q43 46 33 44" fill="#56e7da"/>
    <path d="M88 45Q112 28 117 47Q120 59 95 61" fill="#38c5c9"/>
    <path d="M43 58 54 56M68 56 79 58" stroke="#353444" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="49" cy="61" r="2.5" fill="#23293d"/><circle cx="74" cy="61" r="2.5" fill="#23293d"/>
    <path d="M54 76Q62 79 70 74" stroke="#824b65" stroke-width="3" fill="none"/>
    <path d="M43 86 61 96 80 85Q98 89 104 120H18Q27 92 43 86" fill="#342b46" stroke="#9371a9" stroke-width="2"/>
    <circle cx="61" cy="102" r="8" fill="#a7f86e"/>
    <path d="M44 110H79" stroke="#84ebd9" stroke-width="5"/>
  </svg>`;
}
