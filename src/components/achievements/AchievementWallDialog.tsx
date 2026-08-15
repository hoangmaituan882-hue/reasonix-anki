import { motion, AnimatePresence } from "motion/react";
import { X, Trophy } from "lucide-react";
import { AchievementWall } from "./AchievementWall";

interface AchievementWallDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AchievementWallDialog({
  isOpen,
  onClose,
}: AchievementWallDialogProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-5xl h-[90vh] bg-[var(--rx-bg)] border border-[var(--rx-border-soft)] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[var(--rx-fg)]">
                  成就解封与勋章墙 (Achievement Wall)
                </h2>
                <p className="text-[12px] text-[var(--rx-fg-dim)]">
                  全服荣誉榜与 20+ 款像素微光勋章打卡
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] hover:bg-[var(--rx-sidebar-hover)] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            <AchievementWall />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
