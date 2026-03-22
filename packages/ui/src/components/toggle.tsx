import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "../lib/utils";

export interface ToggleProps
  extends Omit<ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, "children"> {
  label?: string;
}

const Toggle = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, ToggleProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <SwitchPrimitive.Root
          ref={ref}
          id={id}
          className={cn(
            "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=unchecked]:bg-bg-tertiary",
            className,
          )}
          {...props}
        >
          <SwitchPrimitive.Thumb
            className={cn(
              "pointer-events-none block h-4 w-4 rounded-full bg-fg-primary shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
            )}
          />
        </SwitchPrimitive.Root>
        {label && (
          <label htmlFor={id} className="text-sm text-fg-secondary cursor-pointer">
            {label}
          </label>
        )}
      </div>
    );
  },
);
Toggle.displayName = "Toggle";

export { Toggle };
