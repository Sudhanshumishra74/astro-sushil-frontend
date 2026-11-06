/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_QUERY).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

function DialogChrome({ title, onClose, children }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/8 shrink-0">
        <h3 className="font-heading text-primary text-base">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 rounded-full flex items-center justify-center text-black/40 hover:bg-black/5 hover:text-primary transition-colors"
        >
          <X size={17} />
        </button>
      </div>
      <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
    </>
  );
}

// Bottom sheet on small/medium screens, centered modal from the `lg`
// breakpoint (1024px) up — used for the order cancel-confirm and
// return-request dialogs specifically. The app's shared BottomSheet
// component (category filters, etc.) intentionally keeps its existing
// mobile-oriented behavior everywhere else.
export default function ResponsiveDialog({ isOpen, onClose, title, children, footer }) {
  const isDesktop = useIsDesktop();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {isDesktop ? (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="fixed top-1/2 left-1/2 z-50 bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
              initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
              transition={{ duration: 0.2 }}
            >
              <DialogChrome title={title} onClose={onClose}>
                {children}
              </DialogChrome>
              {footer && <div className="px-5 py-3.5 border-t border-black/8 shrink-0">{footer}</div>}
            </motion.div>
          ) : (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
            >
              <div className="w-10 h-1 rounded-full bg-black/15 mx-auto mt-2.5" aria-hidden="true" />
              <DialogChrome title={title} onClose={onClose}>
                {children}
              </DialogChrome>
              {footer && <div className="px-5 py-3.5 border-t border-black/8 shrink-0">{footer}</div>}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
