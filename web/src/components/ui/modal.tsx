"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div 
        className={clsx(
          "relative w-full max-w-lg transform overflow-hidden rounded-2xl bg-[var(--surface)] text-left shadow-2xl transition-all border border-[var(--divider)]",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--divider)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--surface-flat)] hover:text-[var(--text)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
