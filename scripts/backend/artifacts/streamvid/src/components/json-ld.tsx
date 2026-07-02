import { useEffect } from "react";

interface JsonLdProps {
  id: string;
  schema: Record<string, unknown>;
}

export function JsonLd({ id, schema }: JsonLdProps) {
  useEffect(() => {
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schema);

    return () => {
      document.getElementById(id)?.remove();
    };
  }, [id, JSON.stringify(schema)]);

  return null;
}
