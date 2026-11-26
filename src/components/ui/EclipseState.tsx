import React, { useEffect } from 'react';
import { AlertTriangle, Inbox, RefreshCw, X } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
  children,
}) => (
  <div
    data-testid="eclipse-empty-state"
    className={`rounded-2xl bg-[#12141E] border border-[#292B39] p-6 sm:p-10 text-center space-y-3 ${className}`.trim()}
  >
    <div className="w-12 h-12 rounded-2xl bg-[#191C29] border border-[#292B39] text-[#B49AF8] flex items-center justify-center mx-auto">
      {icon || <Inbox className="w-5 h-5" />}
    </div>
    <h3 className="text-base sm:text-lg font-bold text-[#F4F3FA]">{title}</h3>
    {description && (
      <p className="text-xs sm:text-sm text-[#A1A5B5] max-w-md mx-auto leading-relaxed">
        {description}
      </p>
    )}
    {(actionLabel || secondaryActionLabel) && (
      <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
        {actionLabel && onAction && (
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <Button variant="secondary" size="md" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    )}
    {children}
  </div>
);

export interface ErrorStateProps {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to complete request',
  message,
  retryLabel = 'Retry',
  onRetry,
  className = '',
}) => (
  <div
    role="alert"
    data-testid="eclipse-error-state"
    className={`rounded-2xl bg-[#12141E] border border-[#F87171]/40 p-6 sm:p-8 text-center space-y-3 ${className}`.trim()}
  >
    <div className="w-12 h-12 rounded-2xl bg-[#F87171]/15 border border-[#F87171]/30 text-[#F87171] flex items-center justify-center mx-auto">
      <AlertTriangle className="w-5 h-5" />
    </div>
    <h3 className="text-base font-bold text-[#F4F3FA]">{title}</h3>
    <p className="text-xs sm:text-sm text-[#A1A5B5] max-w-md mx-auto leading-relaxed">
      {message}
    </p>
    {onRetry && (
      <div className="pt-1">
        <Button
          variant="danger"
          size="md"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {retryLabel}
        </Button>
      </div>
    )}
  </div>
);

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
  footer,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="eclipse-modal"
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 transition-opacity duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} rounded-t-3xl sm:rounded-2xl bg-[#12141E] border-t sm:border border-[#292B39] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-transform duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[#292B39] bg-[#12141E]">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#F4F3FA] truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[#A1A5B5] truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-11 h-11 sm:w-10 sm:h-10 min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl bg-[#191C29] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-150 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-[#F4F3FA]">
          {children}
        </div>

        {footer && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-[#292B39] bg-[#191C29]/60 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    maxWidthClass="max-w-md"
    footer={
      <>
        <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          size="md"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-xs sm:text-sm text-[#A1A5B5] leading-relaxed">{description}</p>
  </Modal>
);
