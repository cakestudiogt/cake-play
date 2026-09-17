/** Cake tiers — Spanish names, brand-forward colors */
export const CAKES = [
  {
    id: 'cupcake',
    name: 'Cupcake',
    radius: 18,
    color: '#ea98af',
    icing: '#fff8f6',
    emoji: '🧁',
    points: 1,
  },
  {
    id: 'mini',
    name: 'Mini',
    radius: 24,
    color: '#e97a6f',
    icing: '#f4eae9',
    emoji: '🍰',
    points: 3,
  },
  {
    id: 'lonchera',
    name: 'Lonchera',
    radius: 32,
    color: '#BF6C58',
    icing: '#ffe8d6',
    emoji: '🥡',
    points: 6,
  },
  {
    id: 'capa',
    name: 'Capa',
    radius: 40,
    color: '#5ca370',
    icing: '#e8f5ec',
    emoji: '🎂',
    points: 10,
  },
  {
    id: 'torre',
    name: 'Torre',
    radius: 50,
    color: '#1e4f70',
    icing: '#d9e8f2',
    emoji: '🗼',
    points: 18,
  },
  {
    id: 'fiesta',
    name: 'Fiesta',
    radius: 62,
    color: '#c45d8a',
    icing: '#ffe0ef',
    emoji: '🎉',
    points: 30,
  },
  {
    id: 'boda',
    name: 'Boda',
    radius: 74,
    color: '#8b5a3c',
    icing: '#fffdfb',
    emoji: '💒',
    points: 50,
  },
];

/** Next drop is biased to small cakes (Suika-style). */
export function randomDropTier(maxUnlocked = 3) {
  const pool = [];
  const limit = Math.min(maxUnlocked, 3);
  for (let i = 0; i <= limit; i++) {
    const weight = limit + 1 - i;
    for (let w = 0; w < weight; w++) pool.push(i);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function mergeScore(tierIndex) {
  const cake = CAKES[tierIndex];
  return cake ? cake.points * 10 : 0;
}
