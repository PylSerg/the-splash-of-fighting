export type StageId = 'city' | 'lagoon';

export interface StageInfo {
  id: StageId;
  name: string;
  description: string;
  theme: string;
  symbol: string;
}

export const STAGES: readonly StageInfo[] = [
  {
    id: 'city',
    name: 'НЕОНОВЕ МІСТО',
    description: 'Вогні мегаполіса, аркадна арена та нічне небо.',
    theme: 'city',
    symbol: '✦',
  },
  {
    id: 'lagoon',
    name: 'МІСЯЧНА ЛАГУНА',
    description: 'Нічний океан, світло місяця, скелі та тропічний берег.',
    theme: 'lagoon',
    symbol: '☾',
  },
];

export function getStage(id: StageId): StageInfo {
  const stage = STAGES.find(item => item.id === id);
  if (!stage) throw new Error('Unknown stage: ' + id);
  return stage;
}
