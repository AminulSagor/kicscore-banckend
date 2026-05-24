export enum FeaturedTeamSection {
  INTERNATIONAL = 'international',
  CLUB = 'club',
}

export interface FeaturedTeamPromotion {
  canonicalName: string;
  lookupQuery: string;
  section: FeaturedTeamSection;
  aliases: readonly string[];
  priority: number;
}

const team = (
  canonicalName: string,
  lookupQuery: string,
  section: FeaturedTeamSection,
  priority: number,
  aliases: readonly string[] = [],
): FeaturedTeamPromotion => ({
  canonicalName,
  lookupQuery,
  section,
  priority,
  aliases: Array.from(
    new Set([
      canonicalName.toLowerCase(),
      lookupQuery.toLowerCase(),
      ...aliases,
    ]),
  ),
});

export const FEATURED_TEAM_PROMOTIONS: readonly FeaturedTeamPromotion[] = [
  //======= International Teams =======//
  team('Argentina', 'Argentina', FeaturedTeamSection.INTERNATIONAL, 1000, [
    'argentina national team',
  ]),
  team('Brazil', 'Brazil', FeaturedTeamSection.INTERNATIONAL, 995, [
    'brasil',
    'brazil national team',
  ]),
  team('Portugal', 'Portugal', FeaturedTeamSection.INTERNATIONAL, 990, [
    'portugal national team',
  ]),
  team('France', 'France', FeaturedTeamSection.INTERNATIONAL, 985, [
    'france national team',
  ]),
  team('Spain', 'Spain', FeaturedTeamSection.INTERNATIONAL, 980, [
    'spain national team',
  ]),
  team('England', 'England', FeaturedTeamSection.INTERNATIONAL, 975, [
    'england national team',
  ]),
  team('Germany', 'Germany', FeaturedTeamSection.INTERNATIONAL, 970, [
    'germany national team',
  ]),
  team('Italy', 'Italy', FeaturedTeamSection.INTERNATIONAL, 965, [
    'italy national team',
  ]),
  team('Netherlands', 'Netherlands', FeaturedTeamSection.INTERNATIONAL, 960, [
    'holland',
    'netherlands national team',
  ]),
  team('Croatia', 'Croatia', FeaturedTeamSection.INTERNATIONAL, 955, [
    'croatia national team',
  ]),
  team('Uruguay', 'Uruguay', FeaturedTeamSection.INTERNATIONAL, 950, [
    'uruguay national team',
  ]),
  team('Colombia', 'Colombia', FeaturedTeamSection.INTERNATIONAL, 945, [
    'colombia national team',
  ]),
  team('Belgium', 'Belgium', FeaturedTeamSection.INTERNATIONAL, 940, [
    'belgium national team',
  ]),
  team('Morocco', 'Morocco', FeaturedTeamSection.INTERNATIONAL, 935, [
    'morocco national team',
  ]),
  team('Japan', 'Japan', FeaturedTeamSection.INTERNATIONAL, 930, [
    'japan national team',
  ]),
  team('United States', 'USA', FeaturedTeamSection.INTERNATIONAL, 925, [
    'usa',
    'united states',
    'usmnt',
  ]),

  //======= Clubs =======//
  team('Real Madrid', 'Real Madrid', FeaturedTeamSection.CLUB, 1000, [
    'madrid',
    'real madrid cf',
  ]),
  team('Barcelona', 'Barcelona', FeaturedTeamSection.CLUB, 995, [
    'barca',
    'fc barcelona',
  ]),
  team('Manchester City', 'Manchester City', FeaturedTeamSection.CLUB, 990, [
    'man city',
    'mancity',
  ]),
  team(
    'Manchester United',
    'Manchester United',
    FeaturedTeamSection.CLUB,
    985,
    ['man united', 'man utd'],
  ),
  team('Liverpool', 'Liverpool', FeaturedTeamSection.CLUB, 980, [
    'liverpool fc',
  ]),
  team('Arsenal', 'Arsenal', FeaturedTeamSection.CLUB, 975, ['arsenal fc']),
  team('Chelsea', 'Chelsea', FeaturedTeamSection.CLUB, 970, ['chelsea fc']),
  team('Tottenham', 'Tottenham', FeaturedTeamSection.CLUB, 965, [
    'tottenham hotspur',
    'spurs',
  ]),
  team(
    'Paris Saint Germain',
    'Paris Saint Germain',
    FeaturedTeamSection.CLUB,
    960,
    ['psg', 'paris sg'],
  ),
  team('Bayern Munich', 'Bayern Munich', FeaturedTeamSection.CLUB, 955, [
    'bayern',
    'fc bayern',
  ]),
  team(
    'Borussia Dortmund',
    'Borussia Dortmund',
    FeaturedTeamSection.CLUB,
    950,
    ['dortmund', 'bvb'],
  ),
  team('Inter', 'Inter', FeaturedTeamSection.CLUB, 945, [
    'inter milan',
    'internazionale',
  ]),
  team('AC Milan', 'AC Milan', FeaturedTeamSection.CLUB, 940, ['milan']),
  team('Juventus', 'Juventus', FeaturedTeamSection.CLUB, 935, ['juve']),
  team('Napoli', 'Napoli', FeaturedTeamSection.CLUB, 930, ['ssc napoli']),
  team('Atletico Madrid', 'Atletico Madrid', FeaturedTeamSection.CLUB, 925, [
    'atletico',
    'atletico de madrid',
  ]),
  team('Bayer Leverkusen', 'Bayer Leverkusen', FeaturedTeamSection.CLUB, 920, [
    'leverkusen',
  ]),
  team('Al-Nassr', 'Al-Nassr', FeaturedTeamSection.CLUB, 915, ['al nassr']),
  team('Inter Miami', 'Inter Miami', FeaturedTeamSection.CLUB, 910, [
    'inter miami cf',
  ]),
];
