"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./DeleteCollabModal.module.css";

interface DeleteCollabModalProps {
  collabId: string;
  collabName: string;
  onClose: () => void;
}

export default function DeleteCollabModal({
  collabId,
  collabName,
  onClose,
}: DeleteCollabModalProps) {
  const titleId = useId();
  const router = useRouter();
  const [step, setStep] = useState<"ask" | "owner" | "admin">("ask");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function requestDelete(payload: {
    confirmOwner?: boolean;
    adminCode?: string;
  }) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/collabs/${collabId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        needsOwnerConfirm?: boolean;
        needsAdminCode?: boolean;
        error?: string;
      };

      if (res.ok && data.ok) {
        window.dispatchEvent(new Event("colab:nav-start"));
        router.push("/");
        router.refresh();
        return;
      }
      if (data.needsOwnerConfirm) {
        setStep("owner");
        return;
      }
      if (data.needsAdminCode) {
        setStep("admin");
        return;
      }
      setError(data.error || "Não foi possível excluir.");
    } catch {
      setError("Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === "ask") {
      await requestDelete({});
      return;
    }
    if (step === "owner") {
      await requestDelete({ confirmOwner: true });
      return;
    }
    await requestDelete({ adminCode });
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
          <h2 id={titleId}>Excluir collab</h2>
          {step === "ask" && (
            <p>
              Tem certeza que quer excluir <strong>{collabName}</strong>? Essa
              ação não tem volta.
            </p>
          )}
          {step === "owner" && (
            <p>
              Detectamos que você é o dono desta collab (mesmo IP). Confirme a
              exclusão para continuar.
            </p>
          )}
          {step === "admin" && (
            <p>
              Seu IP não é o do criador. Informe o código de administrador gerado
              na criação da collab.
            </p>
          )}
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          {step === "admin" && (
            <label className={styles.field}>
              <span>Código admin</span>
              <input
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
                placeholder="ADM-XXXX-XXXX"
                required
                autoFocus
              />
            </label>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.ghost} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.danger} disabled={saving}>
              {saving
                ? "Excluindo…"
                : step === "owner"
                  ? "Confirmar exclusão"
                  : step === "admin"
                    ? "Validar e excluir"
                    : "Excluir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
