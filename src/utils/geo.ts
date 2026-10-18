import { LocationPoint } from '../types';

/**
 * Calculates straight line distance (Haversine formula) in kilometers between two coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Real road routes in urban environments are typically ~1.3x longer than straight lines
  return Math.round(distance * 1.35 * 10) / 10;
}

/**
 * Estimates driving travel time in minutes based on urban route distance and city traffic
 */
export function estimateTravelTimeMinutes(distanceKm: number): number {
  if (distanceKm <= 0.1) return 0;
  // Average urban speed ~25-30 km/h + 4 minutes buffer for parking and building access
  const minutes = (distanceKm / 28) * 60 + 4;
  return Math.max(5, Math.round(minutes));
}

/**
 * Converts "HH:mm" string to minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Converts minutes from midnight to "HH:mm" formatted string
 */
export function minutesToTimeString(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMinutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Formats duration in minutes to human readable string (e.g. "1h 30m" or "45m")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Checks if a specific time is within a time slot range
 */
export function isWithinWindow(
  timeStr: string,
  startStr: string,
  endStr: string,
  toleranceMinutes: number = 15
): boolean {
  const time = timeStringToMinutes(timeStr);
  const start = timeStringToMinutes(startStr) - toleranceMinutes;
  const end = timeStringToMinutes(endStr) + toleranceMinutes;
  return time >= start && time <= end;
}
