"use client";

import { FormEvent, useId, useState } from "react";
import styles from "./ProposalModal.module.css";

interface ReportModalProps {
  onClose: () => void;
}

export default function ReportModal({ onClose }: ReportModalProps) {
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
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          page:
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : "/",
        }),
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
          <h2 id={titleId}>Encontrei um problema</h2>
          <p>
            Conta o que deu errado e o que você estava fazendo — página, passos,
            o que esperava. Assim fica mais fácil corrigir.
          </p>
        </header>

        {done ? (
          <div className={styles.done}>
            <p>Valeu! Report registrado.</p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>O problema e o cenário</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ex.: cliquei em Pedir remoção na collab X, o badge ficou 1/2, mas ao recarregar a página o voto sumiu..."
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
                {saving ? "Enviando…" : "Enviar report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
