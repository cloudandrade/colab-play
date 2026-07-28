"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./NavigationProgress.module.css";

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const start = () => setLoading(true);

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = (event.target as HTMLElement | null)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || target.target === "_blank") return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
        start();
      } catch {
        // ignore
      }
    };

    window.addEventListener("colab:nav-start", start);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("colab:nav-start", start);
      document.removeEventListener("click", onClick);
    };
  }, []);

  if (!loading) return null;

  return (
    <div className={styles.bar} role="progressbar" aria-label="Carregando página">
      <span className={styles.pulse} />
    </div>
  );
}
