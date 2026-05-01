export type Position = 'GK' | 'LB' | 'CB' | 'RB' | 'LWB' | 'RWB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST' | 'CF';

export interface Player {
  id: string;
  name: string;
  position: Position;
  club: string;
  league: string;
  age: number;
  image: string;
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
}

export interface FormationPosition {
  id: string;
  label: string;
  type: Position;
  x: number; // 0-100 (left to right)
  y: number; // 0-100 (bottom to top, GK at bottom)
}

export interface Formation {
  name: string;
  positions: FormationPosition[];
}

export interface Squad {
  [positionId: string]: Player[];
}
