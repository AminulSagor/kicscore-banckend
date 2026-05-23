export interface FootballSearchPromotion {
  id: number;
  aliases: readonly string[];
  priority: number;
}

export const LEAGUE_SEARCH_PROMOTIONS: readonly FootballSearchPromotion[] = [
  {
    id: 1,
    aliases: ['world cup', 'fifa world cup', 'fifa', 'world', 'wc'],
    priority: 1000,
  },
  {
    id: 15,
    aliases: ['fifa club world cup', 'club world cup'],
    priority: 850,
  },
  {
    id: 2,
    aliases: ['champions league', 'uefa champions league', 'ucl'],
    priority: 950,
  },
  {
    id: 39,
    aliases: ['premier league', 'english premier league', 'epl'],
    priority: 900,
  },
  {
    id: 140,
    aliases: ['la liga', 'laliga', 'spanish league'],
    priority: 880,
  },
];

export const PLAYER_SEARCH_PROMOTIONS: readonly FootballSearchPromotion[] = [
  {
    id: 154,
    aliases: [
      'messi',
      'lionel messi',
      'leo messi',
      'l messi',
      'lionel andres messi',
    ],
    priority: 1000,
  },
  {
    id: 874,
    aliases: ['ronaldo', 'cristiano ronaldo', 'cristiano', 'cr7', 'c ronaldo'],
    priority: 990,
  },
  {
    id: 276,
    aliases: ['neymar', 'neymar jr', 'neymar junior'],
    priority: 980,
  },
];
