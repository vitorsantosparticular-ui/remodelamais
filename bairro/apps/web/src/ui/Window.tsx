import type { ReactNode } from 'react';

/** Janela flutuante clássica (barra de título azul, corpo claro). */
export function Window({ title, onClose, children, width = 380, className = '' }: {
  title: string; onClose?: () => void; children: ReactNode; width?: number; className?: string;
}) {
  return (
    <div className={`win ${className}`} style={{ width: `min(${width}px, calc(100vw - 16px))` }} role="dialog" aria-label={title}>
      <div className="win-title">
        <span>{title}</span>
        {onClose && <button className="win-close" onClick={onClose} aria-label="Fechar">✕</button>}
      </div>
      <div className="win-body">{children}</div>
    </div>
  );
}
