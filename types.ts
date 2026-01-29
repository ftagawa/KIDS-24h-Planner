export interface Activity {
  id: string;
  title: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  color: string;
  icon: string; // Emoji
}

export const PRESET_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEEAD', // Yellow
  '#D4A5A5', // Pink
  '#9B59B6', // Purple
  '#E67E22', // Orange
];

export const PRESET_ICONS = [
  '😴', '🍳', '🏫', '🍱', '🏃', '🎨', '📺', '🛁', '📖', '🎮', '🏠', '🚌'
];
