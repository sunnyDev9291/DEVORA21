import { forwardRef, type InputHTMLAttributes } from "react";
import { ui } from "@/lib/ui-styles";

export interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={ui.label}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            ui.input,
            error ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {!error && hint && <p className={`mt-1.5 ${ui.mutedSm}`}>{hint}</p>}
      </div>
    );
  },
);

AuthInput.displayName = "AuthInput";

export default AuthInput;
