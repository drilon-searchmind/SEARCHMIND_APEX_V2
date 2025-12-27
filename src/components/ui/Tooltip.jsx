import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function Tooltip({ children, content, ...props }) {
    // Ensure only a single React element is passed to Trigger
    const child = React.Children.count(children) === 1 && React.isValidElement(children)
        ? children
        : <span>{children}</span>;
    return (
        <TooltipPrimitive.Provider>
            <TooltipPrimitive.Root delayDuration={200}>
                <TooltipPrimitive.Trigger asChild>{child}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        sideOffset={6}
                        className="z-50 rounded bg-black px-3 py-2 text-xs text-white shadow-lg animate-fade-in"
                        {...props}
                    >
                        {content}
                        <TooltipPrimitive.Arrow className="fill-black" />
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}
