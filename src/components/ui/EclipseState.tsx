import React, { useEffect } from 'react';
import { AlertTriangle, Inbox, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
    className={`rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 sm:p-10 text-center space-y-3 ${className}`.trim()}
  >
    <div className="w-12 h-12 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
      {icon || <Inbox className="w-5 h-5" />}
    </div>
    <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{title}</h3>
    {description && (
      <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
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
  title,
  message,
  retryLabel,
  onRetry,
  className = '',
}) => {
  const { t } = useTranslation(['states', 'common']);
  const resolvedTitle = title || t('states:errorDefaultTitle', 'Something went wrong');
  const resolvedRetry = retryLabel || t('common:retry', 'Retry');
  return (
    <div
      role="alert"
      data-testid="eclipse-error-state"
      className={`rounded-[12px] bg-[var(--bg-surface)] border border-[#F87171]/40 p-6 sm:p-8 text-center space-y-3 ${className}`.trim()}
    >
      <div className="w-12 h-12 rounded-[12px] bg-[#F87171]/15 border border-[#F87171]/30 text-[#F87171] flex items-center justify-center mx-auto">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-base font-bold text-[var(--text-primary)]">{resolvedTitle}</h3>
      <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
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
            {resolvedRetry}
          </Button>
        </div>
      )}
    </div>
  );
};

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
    const previousOverflow = typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="eclipse-modal"
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 transition-opacity duration-180 motion-reduce:transition-none"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} rounded-t-3xl sm:rounded-[12px] bg-[var(--bg-surface)] border-t sm:border border-[var(--border-subtle)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-transform duration-180 motion-reduce:transition-none`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile bottom sheet drag handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-[var(--bg-surface)]">
          <div className="w-10 h-1.5 rounded-full bg-[var(--border-subtle)]" />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-[var(--text-primary)]">
          {children}
        </div>

        {footer && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const BottomSheet = Modal;

export interface ConfirmDialogProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isDestructive?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  open,
  onClose,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  isDestructive = false,
  loading = false,
}) => {
  const { t } = useTranslation(['common']);
  const resolvedOpen = Boolean(isOpen ?? open);
  const resolvedClose = onClose || onCancel || (() => {});
  const resolvedDestructive = Boolean(destructive || isDestructive);
  const resolvedConfirm = confirmLabel || t('common:confirm', 'Confirm');
  const resolvedCancel = cancelLabel || t('common:cancel', 'Cancel');

  return (
    <Modal
      isOpen={resolvedOpen}
      onClose={resolvedClose}
      title={title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={resolvedClose} disabled={loading}>
            {resolvedCancel}
          </Button>
          <Button
            variant={resolvedDestructive ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t('common:loading', 'Loading...') : resolvedConfirm}
          </Button>
        </>
      }
    >
      <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </Modal>
  );
};

export {
  SkeletonCard,
  SkeletonGrid,
  DetailModalSkeleton,
  SchedulePageSkeleton,
  LibraryPageSkeleton,
  ProfilePageSkeleton,
  ChatPageSkeleton,
  PageViewSkeleton,
  AdminSkeleton,
} from '../SkeletonGrid';

