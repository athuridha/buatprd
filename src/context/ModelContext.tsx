"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface AIModel {
  id: string;
  name: string;
  badge?: string;
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: "qwen3.7-max",
    name: "Qwen 3.7 Max",
    badge: "Flagship",
    description: "Model flagship dengan penalaran paling mendalam, komprehensif, dan stabil.",
  },
  {
    id: "ox-alpha",
    name: "Ox Alpha",
    badge: "Deep Reasoning",
    description: "Model penalaran logis canggih untuk analisis sistem dan perancangan teknis mendalam.",
  },
  {
    id: "minimax/minimax-m3:free",
    name: "MiniMax M3",
    badge: "Long Context",
    description: "Kapasitas pemrosesan konteks ekstra luas dengan analisis arsitektur terperinci.",
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    badge: "Architecture & Speed",
    description: "Model cerdas & ultra-cepat untuk arsitektur teknis dan modularitas kode.",
  },
  {
    id: "qwen3.7-plus",
    name: "Qwen 3.7 Plus",
    badge: "Fast & Agile",
    description: "Model berkecepatan tinggi dengan responsivitas optimal dan efisien.",
  },
  {
    id: "z-ai/glm-5.2",
    name: "GLM 5.2",
    badge: "Deep Reason",
    description: "Penalaran logis mendalam dan pemetaan arsitektur sistematis.",
  },
];

interface ModelContextType {
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  currentModelObj: AIModel;
}

const ModelContext = createContext<ModelContextType>({
  selectedModel: "qwen3.7-max",
  setSelectedModel: () => {},
  currentModelObj: AVAILABLE_MODELS[0],
});

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [selectedModel, setSelectedModelState] = useState<string>("qwen3.7-max");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selected_prd_model");
      if (saved && AVAILABLE_MODELS.some((m) => m.id === saved)) {
        setSelectedModelState(saved);
      }
    }
  }, []);

  const setSelectedModel = (modelId: string) => {
    setSelectedModelState(modelId);
    if (typeof window !== "undefined") {
      localStorage.setItem("selected_prd_model", modelId);
    }
  };

  const currentModelObj =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  return (
    <ModelContext.Provider
      value={{ selectedModel, setSelectedModel, currentModelObj }}
    >
      {children}
    </ModelContext.Provider>
  );
}

export const useModel = () => useContext(ModelContext);
