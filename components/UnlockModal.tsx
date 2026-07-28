"use client";

import Link from "next/link";
import { FormEvent, useId, useState } from "react";
import styles from "./UnlockModal.module.css";

interface UnlockModalProps {
  collabId: string;
  collabName: string;
  onUnlocked: () => void;
}

export default function UnlockModal({
  collabId,
  collabName,
  onUnlocked,
}: UnlockModalProps) {
  const titleId = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/collabs/${collabId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Senha incorreta.");
        return;
      }
      onUnlocked();
    } catch {
      setError("Não foi possível entrar agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <h2 id={titleId}>Collab fechada</h2>
          <p>
            <strong>{collabName}</strong> pede senha para entrar e adicionar
            músicas.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              required
              autoFocus
              autoComplete="current-password"
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? "Entrando…" : "Entrar"}
          </button>

          <Link href="/" className={styles.back}>
            Voltar às collabs
          </Link>
        </form>
      </div>
    </div>
  );
}
