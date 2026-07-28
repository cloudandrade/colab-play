"use client";

import { FormEvent, useId, useState } from "react";
import styles from "./ProposalModal.module.css";

interface ProposalModalProps {
  onClose: () => void;
}

export default function ProposalModal({ onClose }: ProposalModalProps) {
  const titleId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Não foi possível enviar.");
        return;
      }
      setDone(true);
    } catch {
      setError("Não foi possível enviar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id={titleId}>Proposta de melhoria</h2>
          <p>Conta o que você mudaria no CoLab Play. A gente lê direto no banco.</p>
        </header>

        {done ? (
          <div className={styles.done}>
            <p>Valeu! Proposta registrada.</p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Sua ideia</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ex.: quero poder reordenar a fila arrastando..."
                required
                maxLength={2000}
                rows={5}
                autoFocus
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.ghost} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className={styles.primary} disabled={saving}>
                {saving ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
