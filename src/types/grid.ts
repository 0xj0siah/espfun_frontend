export interface GridMatch {
  id: string;
  tournament: string;
  team1: string;
  team2: string;
  time: string;
  date: string;
  game: string;
  format: string;
}

export interface GridApiResponse {
  data: {
    allSeries: {
      edges: Array<{
        node: {
          id: string;
          title: {
            nameShortened: string;
          };
          tournament: {
            nameShortened: string;
          };
          startTimeScheduled: string;
          format: {
            name: string;
            nameShortened: string;
          };
          teams: Array<{
            baseInfo: {
              name: string;
              nameShortened: string;
            };
            scoreAdvantage: number;
          }>;
        };
      }>;
    };
  };
}