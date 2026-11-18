import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

export function FixtureResolutionModal({
  open,
  status,
  reason,
  saving,
  onClose,
  onStatusChange,
  onReasonChange,
  onSubmit,
}: {
  open: boolean;
  status: "cancelled" | "abandoned";
  reason: string;
  saving: boolean;
  onClose: () => void;
  onStatusChange: (status: "cancelled" | "abandoned") => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}) {
  const isCancelled = status === "cancelled";
  return (
    <Modal
      open={open}
      title={isCancelled ? "Cancel fixture" : "Abandon fixture"}
      description="This decision will be saved to the fixture's audit history."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <div>
          <p className="mb-2 text-sm font-semibold text-fg">Fixture decision</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" aria-pressed={isCancelled} onClick={() => onStatusChange("cancelled")} className={`rounded-xl border p-3 text-left transition ${isCancelled ? "border-danger bg-danger/10 ring-1 ring-danger/20" : "border-line bg-surface hover:border-danger/50"}`}>
              <span className="block text-sm font-semibold text-fg">Cancel match</span>
              <span className="mt-1 block text-xs text-muted">Fixture will not be played.</span>
            </button>
            <button type="button" aria-pressed={!isCancelled} onClick={() => onStatusChange("abandoned")} className={`rounded-xl border p-3 text-left transition ${!isCancelled ? "border-gold bg-gold/10 ring-1 ring-gold/20" : "border-line bg-surface hover:border-gold/50"}`}>
              <span className="block text-sm font-semibold text-fg">Abandon match</span>
              <span className="mt-1 block text-xs text-muted">Match started but could not continue.</span>
            </button>
          </div>
        </div>
        <label className="block text-sm font-semibold text-fg">
          Reason for decision <span className="text-danger">*</span>
          <Textarea className="mt-2" required minLength={3} maxLength={500} value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Record who decided and why this fixture was cancelled or abandoned." />
          <span className="mt-1 block text-xs font-normal text-muted">{reason.trim().length}/500 characters · Minimum 3 characters</span>
        </label>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="surface" onClick={onClose}>Go back</Button>
          <Button type="submit" variant="danger" disabled={saving || reason.trim().length < 3}>{saving ? "Saving…" : isCancelled ? "Confirm cancellation" : "Confirm abandonment"}</Button>
        </div>
      </form>
    </Modal>
  );
}
