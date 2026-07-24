import { useEffect } from "react";

// Mobile: fixed off-canvas drawer toggled via isOpen, with a backdrop.
// Desktop (lg+): relative in-flow sidebar, always visible, exactly like before.
// className must not include its own position utility (e.g. "relative") — same-specificity
// utilities are ordered by Tailwind's stylesheet, so a plain "relative" would beat "fixed".
function SidebarShell({ isOpen, onClose, className = "", children }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[82vw] -translate-x-full overflow-y-auto shadow-2xl transition-transform duration-200 ease-in-out lg:relative lg:z-auto lg:min-h-screen lg:w-full lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : ""
        } ${className}`}
      >
        {children}
      </aside>
    </>
  );
}

export default SidebarShell;
