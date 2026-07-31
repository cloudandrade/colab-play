"use client";

import { FormEvent, useId, useState } from "react";
import {
  AVATAR_IDS,
  AVATAR_LABELS,
  avatarSrc,
  type AvatarId,
} from "@/lib/avatars";
import type { CollabDetail } from "@/lib/types";
import styles from "./ProfileModal.module.css";

interface ProfileModalProps {
  collabId: string;
  collabName: string;
  onSaved: (collab: CollabDetail) => void;
}

export default function ProfileModal({
  collabId,
  collabName,
  onSaved,
}: ProfileModalProps) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>("fox");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/collabs/${collabId}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarId }),
      });
      const data = (await res.json()) as {
        collab?: CollabDetail;
        error?: string;
      };
      if (!res.ok || !data.collab) {
        setError(data.error || "Não foi possível salvar.");
        return;
      }
      onSaved(data.collab);
    } catch {
      setError("Não foi possível salvar agora.");
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
          <h2 id={titleId}>Como você aparece aqui?</h2>
          <p>
            Em <strong>{collabName}</strong>, escolha um nome e uma figurinha.
            Assim a galera vê quem adicionou cada faixa.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Seu nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Ex.: Ju, Dani, Kiko…"
              autoComplete="nickname"
              autoFocus
              required
            />
          </label>

          <fieldset className={styles.avatars}>
            <legend>Figurinha</legend>
            <div className={styles.avatarGrid}>
              {AVATAR_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.avatarOption} ${
                    avatarId === id ? styles.avatarSelected : ""
                  }`}
                  onClick={() => setAvatarId(id)}
                  aria-pressed={avatarId === id}
                  aria-label={AVATAR_LABELS[id]}
                  title={AVATAR_LABELS[id]}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarSrc(id)} alt="" width={56} height={56} />
                </button>
              ))}
            </div>
          </fieldset>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.primary} disabled={saving}>
            {saving ? "Salvando…" : "Entrar na collab"}
          </button>
        </form>
      </div>
    </div>
  );
}
