import { forwardRef, useId } from 'react';
import { TextField } from '@radix-ui/themes';
import { cn } from '@/lib/utils';

export interface InputProps extends TextField.RootProps {
  label?: string;
  error?: string;
}
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="ui-field">
        {label && (
          <label htmlFor={inputId} className="ui-field-label">
            {label}
          </label>
        )}
        <TextField.Root
          {...props}
          id={inputId}
          type={type}
          ref={ref}
          size="3"
          color={error ? 'red' : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : props['aria-describedby']}
          className={cn('ui-input', error && 'ui-input--invalid', className)}
        />
        {error && (
          <p id={`${inputId}-error`} role="alert" className="ui-field-error">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
export { Input };
