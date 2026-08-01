'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  sound: boolean;
  music: boolean;
  haptic: boolean;
  toggle: (key: 'sound' | 'music' | 'haptic') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sound: true,
      music: true,
      haptic: true,
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
    }),
    {
      name: 'sugu_settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
