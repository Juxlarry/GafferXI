
export const formatPlayerName = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  
  const firstName = parts[0];
  const remainingNames = parts.slice(1).join(' ');
  
  // Format: L. Ati-Zigi or K. Peprah Oppong
  return `${firstName[0].toUpperCase()}. ${remainingNames}`;
};

export const getJerseyName = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  
  // If it's a long name, take the last part
  const lastPart = parts[parts.length - 1];
  
  // If the last part is very long (e.g., Königsdörffer), we'll keep it but the component will scale it
  // However, usually we just want the surname or common name
  return lastPart.toUpperCase();
};

export const getJerseyNumber = (player: any) => {
  // Simple deterministic jersey numbers based on ID or position
  const positionToNum: Record<string, number> = {
    'GK': 1,
    'LB': 3,
    'CB': 4,
    'RB': 2,
    'CDM': 6,
    'CM': 8,
    'CAM': 10,
    'LM': 17,
    'RM': 7,
    'LW': 11,
    'RW': 19,
    'ST': 9
  };
  
  return positionToNum[player.position] || 20;
};
