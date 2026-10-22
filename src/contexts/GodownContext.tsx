import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, Godown } from '../api';

interface GodownContextType {
  godowns: Godown[];
  currentGodown: Godown | null;
  loading: boolean;
  setCurrentGodown: (godown: Godown) => void;
  selectGodownById: (id: number) => void;
  refreshGodowns: () => Promise<void>;
  createGodown: (name: string, address?: string) => Promise<{ success: boolean; data?: Godown; error?: string }>;
}

const GodownContext = createContext<GodownContextType | undefined>(undefined);

const STORAGE_KEY = 'raxine_wms_active_godown_id';

export const GodownProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [currentGodown, setCurrentGodownState] = useState<Godown | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshGodowns = useCallback(async () => {
    try {
      const res = await api.godowns.list(false);
      if (res.success && res.data) {
        setGodowns(res.data);
        const storedId = localStorage.getItem(STORAGE_KEY);
        let selected: Godown | undefined;

        if (storedId) {
          selected = res.data.find(g => g.id === Number(storedId));
        }

        if (!selected && res.data.length > 0) {
          selected = res.data[0];
        }

        if (selected) {
          setCurrentGodownState(selected);
          localStorage.setItem(STORAGE_KEY, String(selected.id));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGodowns();
  }, [refreshGodowns]);

  const setCurrentGodown = (godown: Godown) => {
    setCurrentGodownState(godown);
    localStorage.setItem(STORAGE_KEY, String(godown.id));
  };

  const selectGodownById = (id: number) => {
    const found = godowns.find(g => g.id === id);
    if (found) {
      setCurrentGodown(found);
    }
  };

  const createGodown = async (name: string, address?: string) => {
    const res = await api.godowns.create({ name, address });
    if (res.success && res.data) {
      await refreshGodowns();
      setCurrentGodown(res.data);
    }
    return res;
  };

  return (
    <GodownContext.Provider
      value={{
        godowns,
        currentGodown,
        loading,
        setCurrentGodown,
        selectGodownById,
        refreshGodowns,
        createGodown,
      }}
    >
      {children}
    </GodownContext.Provider>
  );
};

export function useGodown(): GodownContextType {
  const ctx = useContext(GodownContext);
  if (!ctx) {
    throw new Error('useGodown must be used within a GodownProvider');
  }
  return ctx;
}
