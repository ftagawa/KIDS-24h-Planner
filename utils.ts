import { Activity } from './types';

// Convert HH:MM to total minutes
export const toMinutes = (h: number, m: number) => h * 60 + m;

// Convert total minutes to HH:MM object
export const fromMinutes = (totalMinutes: number) => {
  let normalized = totalMinutes % 1440;
  if (normalized < 0) normalized += 1440;
  const h = Math.floor(normalized / 60);
  const m = Math.floor(normalized % 60);
  return { h, m };
};

// Calculate angle (radians) from time. 00:00 is -PI/2 (top)
export const timeToAngle = (h: number, m: number) => {
  const totalMins = toMinutes(h, m);
  // 0 mins = 0 rads (top) in d3.arc if configured correctly, 
  // but standard trig is 0 at right.
  // We will let D3 handle the projection, mapping 0-1440 to 0-2PI
  return (totalMins / 1440) * 2 * Math.PI;
};

// Check if a time point is within an activity
export const isTimeInActivity = (totalMinutes: number, activity: Activity) => {
  const start = toMinutes(activity.startHour, activity.startMinute);
  const end = toMinutes(activity.endHour, activity.endMinute);
  
  if (end < start) {
    // Overnight activity
    return totalMinutes >= start || totalMinutes < end;
  }
  return totalMinutes >= start && totalMinutes < end;
};

export const formatTime = (h: number, m: number) => {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
