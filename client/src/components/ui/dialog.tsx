import { forwardRef, useRef } from 'react';
import { Dialog as ThemesDialog, IconButton } from '@radix-ui/themes';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = ThemesDialog.Root;
type TriggerProps = React.ComponentPropsWithoutRef<typeof ThemesDialog.Trigger> & {
  asChild?: boolean;
};
const DialogTrigger = forwardRef<React.ElementRef<typeof ThemesDialog.Trigger>, TriggerProps>(
  ({ asChild = false, children, ...props }, ref) => (
    <ThemesDialog.Trigger ref={ref} {...props}>
      {asChild ? children : <button type="button">{children}</button>}
    </ThemesDialog.Trigger>
  ),
);
DialogTrigger.displayName = 'DialogTrigger';
type CloseProps = React.ComponentPropsWithoutRef<typeof ThemesDialog.Close> & { asChild?: boolean };
const DialogClose = forwardRef<React.ElementRef<typeof ThemesDialog.Close>, CloseProps>(
  ({ asChild = false, children, ...props }, ref) => (
    <ThemesDialog.Close ref={ref} {...props}>
      {asChild ? children : <button type="button">{children}</button>}
    </ThemesDialog.Close>
  ),
);
DialogClose.displayName = 'DialogClose';

const DialogContent = forwardRef<
  React.ElementRef<typeof ThemesDialog.Content>,
  React.ComponentPropsWithoutRef<typeof ThemesDialog.Content>
>(({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <ThemesDialog.Content
      ref={ref}
      className={cn('nesomn-dialog', className)}
      {...props}
      onOpenAutoFocus={(event) => {
        returnFocus.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        onOpenAutoFocus?.(event);
      }}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (!event.defaultPrevented && returnFocus.current?.isConnected) {
          event.preventDefault();
          returnFocus.current.focus();
        }
      }}
    >
      {children}
      <ThemesDialog.Close>
        <IconButton
          type="button"
          variant="ghost"
          color="gray"
          className="nesomn-dialog-close"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </IconButton>
      </ThemesDialog.Close>
    </ThemesDialog.Content>
  );
});
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-dialog-header', className)} {...props} />;
}
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-dialog-footer', className)} {...props} />;
}
const DialogTitle = forwardRef<
  React.ElementRef<typeof ThemesDialog.Title>,
  React.ComponentPropsWithoutRef<typeof ThemesDialog.Title>
>(({ className, ...props }, ref) => (
  <ThemesDialog.Title ref={ref} className={cn('nesomn-dialog-title', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';
const DialogDescription = forwardRef<
  React.ElementRef<typeof ThemesDialog.Description>,
  React.ComponentPropsWithoutRef<typeof ThemesDialog.Description>
>(({ className, ...props }, ref) => (
  <ThemesDialog.Description
    ref={ref}
    className={cn('nesomn-dialog-description', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
