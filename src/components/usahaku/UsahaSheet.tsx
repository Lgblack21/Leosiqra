'use client';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Modal } from '@/components/ui/Modal';

// Lembar form Usahaku: HP = bottom sheet, web = modal.
export function UsahaSheet({
  variant,
  open,
  onClose,
  title,
  wide,
  children,
}: {
  variant: 'web' | 'app';
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  if (variant === 'app')
    return (
      <BottomSheet isOpen={open} onClose={onClose} title={title}>
        <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{children}</div>
      </BottomSheet>
    );
  return (
    <Modal isOpen={open} onClose={onClose} title={title} maxWidth={wide ? 'max-w-xl' : 'max-w-md'}>
      {children}
    </Modal>
  );
}
