import { WidgetGallery } from "./WidgetGallery";

interface DesktopWidgetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPinWidget?: (widgetId: string) => void;
}

export function DesktopWidgetsDialog({
  isOpen,
  onClose,
  onPinWidget,
}: DesktopWidgetsDialogProps) {
  return (
    <WidgetGallery
      isOpen={isOpen}
      onClose={onClose}
      onPinWidget={onPinWidget}
    />
  );
}


