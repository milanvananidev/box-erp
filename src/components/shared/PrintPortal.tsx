import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into #print-root (a direct child of <body>) and opens the
 * print dialog. Print CSS in index.css hides everything else, so only this
 * content is printed. `window.print()` blocks until the dialog closes, then
 * onDone unmounts the portal.
 */
export function PrintPortal({ children, onDone }: { children: React.ReactNode; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const [el] = useState(() => {
    const d = document.createElement("div");
    d.id = "print-root";
    return d;
  });
  useEffect(() => {
    document.body.appendChild(el);
    const t = setTimeout(() => {
      window.print();
      done.current();
    }, 50); // let React paint the content first
    return () => {
      clearTimeout(t);
      el.remove();
    };
  }, [el]);
  return createPortal(children, el);
}
