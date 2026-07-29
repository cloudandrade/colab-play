"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import CreateCollabModal from "@/components/CreateCollabModal";
import ProposalModal from "@/components/ProposalModal";
import ReportModal from "@/components/ReportModal";
import type { CollabPublic } from "@/lib/types";
import styles from "@/app/page.module.css";

interface HomeLobbyProps {
  initialCollabs: CollabPublic[];
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesCollabName(name: string, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;

  const n = normalizeText(name);
  if (n.includes(q)) return true;

  const words = n.split(/\s+/).filter(Boolean);
  if (words.some((word) => word.startsWith(q) || q.startsWith(word))) {
    return true;
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) =>
    words.some((word) => word.includes(token) || token.includes(word)),
  );
}

export default function HomeLobby({ initialCollabs }: HomeLobbyProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredCollabs = useMemo(
    () => initialCollabs.filter((collab) => matchesCollabName(collab.name, search)),
    [initialCollabs, search],
  );

  function handleCreated(id: string) {
    setModalOpen(false);
    window.dispatchEvent(new Event("colab:nav-start"));
    router.push(`/collab/${id}`);
  }

  return (
    <div className={styles.shellHome}>
      <section className={styles.heroBleed}>
        <Image
          src="/hero-collab.jpg"
          alt="Jovens curtindo música juntos"
          fill
          priority
          className={styles.heroImage}
          sizes="100vw"
        />
        <div className={styles.heroShade} aria-hidden />
        <div className={styles.heroContent}>
          <h1 className={styles.brandHero}>
            <span>CoLab</span>
            <span>Play</span>
          </h1>
          <p className={styles.leadHero}>
            Monte a playlist com a galera. Escolha entre collab pública ou
            privada — a música une, a vibe é coletiva.
          </p>
          <button
            type="button"
            className={styles.createBtn}
            onClick={() => setModalOpen(true)}
          >
            Criar collab
          </button>
        </div>
      </section>

      <main className={styles.mainHome}>
        <section className={styles.lobby} aria-labelledby="lobby-heading">
          <div className={styles.lobbyHead}>
            <div>
              <p className={styles.lobbyEyebrow}>Na área</p>
              <h2 id="lobby-heading">Collabs rolando</h2>
            </div>
            {initialCollabs.length > 0 && (
              <label className={styles.collabSearch}>
                <span className={styles.srOnly}>Buscar collab</span>
                <span className={styles.collabSearchIcon} aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <circle
                      cx="11"
                      cy="11"
                      r="6.5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="m16.2 16.2 4.3 4.3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar collab…"
                  autoComplete="off"
                />
              </label>
            )}
          </div>

          {initialCollabs.length === 0 ? (
            <p className={styles.emptyLobby}>
              Nenhuma collab ainda. Cria a primeira e chama o rolê.
            </p>
          ) : filteredCollabs.length === 0 ? (
            <p className={styles.emptyLobby}>
              Nenhuma collab encontrada para “{search.trim()}”.
            </p>
          ) : (
            <ul className={styles.collabList}>
              {filteredCollabs.map((collab, index) => (
                <li key={collab.id}>
                  <Link
                    href={`/collab/${collab.id}`}
                    className={styles.collabCard}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <span className={styles.collabMain}>
                      <strong>{collab.name}</strong>
                      <span>
                        {collab.trackCount} faixa
                        {collab.trackCount === 1 ? "" : "s"} na fila
                      </span>
                    </span>
                    <span
                      className={`${styles.badge} ${
                        collab.isOpen ? styles.badgeOpen : styles.badgeClosed
                      }`}
                    >
                      {collab.isOpen ? "Aberta" : "Fechada"}
                    </span>
                    <span className={styles.enter}>Entrar →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <div className={styles.feedbackBtns}>
        <button
          type="button"
          className={styles.feedbackBtn}
          onClick={() => setReportOpen(true)}
          aria-label="Encontrei um problema"
        >
          <span className={styles.feedbackIcon} aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path
                d="M12 7v7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="17.2" r="1.2" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.feedbackLabel}>Encontrei um problema</span>
        </button>
        <button
          type="button"
          className={styles.feedbackBtn}
          onClick={() => setProposalOpen(true)}
          aria-label="Sugestão de melhoria"
        >
          <span className={styles.feedbackIcon} aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path
                d="M9 18h6M10 21h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M12 3a6 6 0 0 0-3.5 10.8c.6.45 1 1.1 1.1 1.85V16h4.8v-.35c.1-.75.5-1.4 1.1-1.85A6 6 0 0 0 12 3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.feedbackLabel}>Sugestão de melhoria</span>
        </button>
      </div>

      {modalOpen && (
        <CreateCollabModal
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {proposalOpen && <ProposalModal onClose={() => setProposalOpen(false)} />}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
    </div>
  );
}
