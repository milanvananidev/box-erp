import * as React from "react";
import { cn } from "@/lib/utils";
import { inputBase } from "./input";

export function formatIndianCurrencyString(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === "") return "";
  const str = String(val).replace(/,/g, "").trim();
  if (str === "" || isNaN(Number(str))) return str;

  const [intPart, decPart] = str.split(".");
  const isNegative = intPart.startsWith("-");
  const cleanInt = isNegative ? intPart.slice(1) : intPart;

  let lastThree = cleanInt.slice(-3);
  const otherNumbers = cleanInt.slice(0, -3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formattedInt =
    (isNegative ? "-" : "") +
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") +
    lastThree;

  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

export function parseIndianCurrencyNumber(val: string): number | undefined {
  if (!val) return undefined;
  const clean = val.replace(/[^0-9.-]/g, "");
  if (!clean || clean === "-" || clean === ".") return undefined;
  const n = Number(clean);
  return isNaN(n) ? undefined : n;
}

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: number | string | null;
  onChange?: (value: number | undefined) => void;
  showPrefix?: boolean;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, showPrefix = true, disabled, placeholder = "0", ...props }, ref) => {
    const [displayVal, setDisplayVal] = React.useState<string>(() =>
      formatIndianCurrencyString(value),
    );
    const [isFocused, setIsFocused] = React.useState(false);

    // Sync from external value when not focused or when value changed externally
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayVal(formatIndianCurrencyString(value));
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      // Allow only digits, comma, decimal point, and negative sign
      const cleanInput = input.replace(/[^0-9.,-]/g, "");

      if (cleanInput === "" || cleanInput === "-") {
        setDisplayVal(cleanInput);
        onChange?.(undefined);
        return;
      }

      // Remove existing commas to format freshly
      const raw = cleanInput.replace(/,/g, "");
      const parts = raw.split(".");
      // Keep only first decimal point
      const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;

      const formatted = formatIndianCurrencyString(sanitized);
      setDisplayVal(formatted);

      const num = parseIndianCurrencyNumber(sanitized);
      onChange?.(num);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // Clean up any trailing decimal on blur (e.g. "1,000." -> "1,000")
      if (displayVal.endsWith(".")) {
        const trimmed = displayVal.slice(0, -1);
        setDisplayVal(trimmed);
        onChange?.(parseIndianCurrencyNumber(trimmed));
      }
      props.onBlur?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    return (
      <div className="relative flex items-center w-full">
        {showPrefix && (
          <span
            className={cn(
              "absolute left-3 select-none pointer-events-none text-sm font-semibold transition-colors",
              disabled ? "text-muted-foreground/50" : "text-muted-foreground",
            )}
            aria-hidden="true"
          >
            ₹
          </span>
        )}
        <input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={displayVal}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            inputBase,
            showPrefix && "pl-7",
            "tabular font-mono font-semibold text-foreground",
            className,
          )}
        />
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";
