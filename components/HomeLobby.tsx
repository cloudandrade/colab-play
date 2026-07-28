"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CreateCollabModal from "@/components/CreateCollabModal";
import ProposalModal from "@/components/ProposalModal";
import type { CollabPublic } from "@/lib/types";
import styles from "@/app/page.module.css";

interface HomeLobbyProps {
  initialCollabs: CollabPublic[];
}

export default function HomeLobby({ initialCollabs }: HomeLobbyProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const collabs = initialCollabs;

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
          </div>

          {collabs.length === 0 ? (
            <p className={styles.emptyLobby}>
              Nenhuma collab ainda. Cria a primeira e chama o rolê.
            </p>
          ) : (
            <ul className={styles.collabList}>
              {collabs.map((collab, index) => (
                <li key={collab.id}>
                  <Link
                    href={`/collab/${collab.id}`}
                    className={styles.collabCard}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <span className={styles.collabIndex} aria-hidden>
                      {String(index + 1).padStart(2, "0")}
                    </span>
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

      <button
        type="button"
        className={styles.proposalBtn}
        onClick={() => setProposalOpen(true)}
      >
        Propostas de melhoria
      </button>

      {modalOpen && (
        <CreateCollabModal
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {proposalOpen && <ProposalModal onClose={() => setProposalOpen(false)} />}
    </div>
  );
}
