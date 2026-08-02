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
    badge: "Default",
    description: "Model tertinggi dengan penalaran paling mendalam & komprehensif.",
  },
  {
    id: "qwen3.7-max-2026-06-08",
    name: "Qwen 3.7 Max (2026-06-08)",
    badge: "Snapshot",
    description: "Snapshot rilis spesifik 2026-06-08 dari Qwen 3.7 Max.",
  },
  {
    id: "qwen3.7-plus",
    name: "Qwen 3.7 Plus",
    badge: "Balanced",
    description: "Performa seimbang, responsif, dan hemat waktu generation.",
  },
  {
    id: "glm-5.2",
    name: "GLM 5.2",
    badge: "Alternative",
    description: "General Language Model 5.2 untuk variasi analisis & sudut pandang.",
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
