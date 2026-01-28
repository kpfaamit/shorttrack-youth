import { useState, useEffect, useCallback } from 'react';
import type { Manifest, Skater, Event, Heat, PassEvent, Models, Incident, CrashEvent, MedalRecord } from '../types/data';

interface SkaterProfileData {
  profiles: Record<string, {
    skater_id: number;
    name: string;
    country: string;
    gender: string;
    age: number;
    age_category: string;
    home_town: string | null;
    club: string | null;
    personal_bests: {
      distance: number;
      class: string;
      time: string;
      competition: string;
      date: string;
    }[];
  }>;
}

interface AppData {
  manifest: Manifest | null;
  skaters: Skater[];
  events: Event[];
  heats: Heat[];
  passes: PassEvent[];
  models: Models | null;
  incidents: Incident[];
  crashes: CrashEvent[];
  medals: MedalRecord[];
  profiles: SkaterProfileData['profiles'] | null;
  loading: boolean;
  error: string | null;
}

const initialState: AppData = {
  manifest: null,
  skaters: [],
  events: [],
  heats: [],
  passes: [],
  models: null,
  incidents: [],
  crashes: [],
  medals: [],
  profiles: null,
  loading: true,
  error: null,
};

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export function useData() {
  const [data, setData] = useState<AppData>(initialState);

  const loadData = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true, error: null }));
    try {
      const [manifest, skaters, events, heats, passes, models, incidents, crashes, medals, profilesData] = await Promise.all([
        fetchJSON<Manifest>('/data/manifest.json'),
        fetchJSON<Skater[]>('/data/skaters.json'),
        fetchJSON<Event[]>('/data/events.json'),
        fetchJSON<Heat[]>('/data/heats.json').catch(() => [] as Heat[]),
        fetchJSON<PassEvent[]>('/data/passes.json').catch(() => [] as PassEvent[]),
        fetchJSON<Models>('/data/models.json').catch(() => null),
        fetchJSON<Incident[]>('/data/incidents.json').catch(() => [] as Incident[]),
        fetchJSON<CrashEvent[]>('/data/crashes.json').catch(() => [] as CrashEvent[]),
        fetchJSON<MedalRecord[]>('/data/medals.json').catch(() => [] as MedalRecord[]),
        fetchJSON<SkaterProfileData>('/data/scraped_profiles/skater_profiles.json').catch(() => null),
      ]);
      const profiles = profilesData?.profiles ?? null;
      setData({ manifest, skaters, events, heats, passes, models, incidents, crashes, medals, profiles, loading: false, error: null });
    } catch (err) {
      setData(prev => ({ ...prev, loading: false, error: (err as Error).message }));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return data;
}
