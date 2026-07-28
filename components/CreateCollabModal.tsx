"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import styles from "./CreateCollabModal.module.css";

interface CreateCollabModalProps {
  onClose: () => void;
  onCreated: (collabId: string) => void;
}

export default function CreateCollabModal({
  onClose,
  onCreated,
}: CreateCollabModalProps) {
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adminCode, setAdminCode] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (adminCode) return;
    const timer = window.setTimeout(() => nameRef.current?.focus(), 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !adminCode) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, adminCode]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/collabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          isOpen,
          password: isOpen ? undefined : password,
        }),
      });
      const data = (await res.json()) as {
        collab?: { id: string };
        adminCode?: string;
        error?: string;
      };
      if (!res.ok || !data.collab || !data.adminCode) {
        setError(data.error || "Não foi possível criar a collab.");
        return;
      }
      setCreatedId(data.collab.id);
      setAdminCode(data.adminCode);
    } catch {
      setError("Não foi possível criar a collab.");
    } finally {
      setSaving(false);
    }
  }

  async function copyCode() {
    if (!adminCode) return;
    try {
      await navigator.clipboard.writeText(adminCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={adminCode ? undefined : onClose}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {adminCode && createdId ? (
          <>
            <header className={styles.header}>
              <h2 id={titleId}>Guarde seu código admin</h2>
              <p>
                Esse código será necessário para excluir a collab se você não
                estiver no mesmo IP de quem criou. Tire um print ou foto agora —
                ele não aparece de novo.
              </p>
            </header>

            <div className={styles.adminBox}>
              <code>{adminCode}</code>
              <button type="button" className={styles.ghost} onClick={copyCode}>
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => onCreated(createdId)}
              >
                Entendi, ir para a collab
              </button>
            </div>
          </>
        ) : (
          <>
            <header className={styles.header}>
              <h2 id={titleId}>Nova collab</h2>
              <p>Escolhe o nome, libera pra galera ou trava com senha.</p>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span>Nome da collab</span>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Sexta no rolê"
                  required
                  maxLength={60}
                />
              </label>

              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => setIsOpen(e.target.checked)}
                />
                <span>Collab aberta — qualquer um entra e adiciona música</span>
              </label>

              {!isOpen && (
                <label className={styles.field}>
                  <span>Senha de acesso</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Defina uma senha"
                    required
                    minLength={3}
                    autoComplete="new-password"
                  />
                </label>
              )}

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.actions}>
                <button type="button" className={styles.ghost} onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className={styles.primary} disabled={saving}>
                  {saving ? "Criando…" : "Criar collab"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
