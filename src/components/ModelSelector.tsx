"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, CaretUp, CaretDown, Check, Sparkle } from "@phosphor-icons/react";
import { useModel, AVAILABLE_MODELS } from "@/context/ModelContext";

interface ModelSelectorProps {
  dropUp?: boolean;
  value?: string;
  onChange?: (modelId: string) => void;
}

export default function ModelSelector({
  dropUp = true,
  value: propValue,
  onChange: propOnChange,
}: ModelSelectorProps) {
  const { selectedModel: globalModel, setSelectedModel: setGlobalModel, currentModelObj: globalObj } = useModel();
  
  const currentModelId = propValue || globalModel;
  const currentModelObj = AVAILABLE_MODELS.find((m) => m.id === currentModelId) || globalObj;

  const handleSelect = (modelId: string) => {
    if (propOnChange) {
      propOnChange(modelId);
    } else {
      setGlobalModel(modelId);
    }
    setIsOpen(false);
  };

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative z-50 inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-surface-2/90 hover:bg-surface-3 border border-border/70 hover:border-accent/50 rounded-xl px-3 py-2 text-xs text-foreground font-medium transition-all cursor-pointer shadow-xs"
        title="Pilih AI Model"
      >
        <Cpu size={15} weight="bold" className="text-accent flex-shrink-0" />
        <span className="font-bold">{currentModelObj.name}</span>
        {dropUp ? (
          <CaretUp
            size={12}
            weight="bold"
            className={`text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        ) : (
          <CaretDown
            size={12}
            weight="bold"
            className={`text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute right-0 w-72 rounded-2xl bg-surface-1/95 border border-border/90 shadow-2xl backdrop-blur-2xl z-[999] p-1.5 space-y-1 ${
              dropUp ? "bottom-full mb-2.5" : "top-full mt-2.5"
            }`}
          >
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1 flex items-center justify-between">
              <span>Pilihan AI Model</span>
              <Sparkle size={12} className="text-accent" />
            </div>

            {AVAILABLE_MODELS.map((model) => {
              const isSelected = currentModelId === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelect(model.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-accent/10 border border-accent/30 text-foreground font-semibold"
                      : "hover:bg-surface-2 text-muted hover:text-foreground border border-transparent"
                  }`}
                >
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">{model.name}</span>
                      {model.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected
                              ? "bg-accent text-background font-semibold"
                              : "bg-surface-3 text-muted-foreground"
                          }`}
                        >
                          {model.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 leading-tight font-normal">
                      {model.description}
                    </p>
                  </div>

                  {isSelected && (
                    <Check
                      size={15}
                      weight="bold"
                      className="text-accent flex-shrink-0 mt-0.5"
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
