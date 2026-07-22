"use client";

import React from "react";

interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  ratio?: number;
  asChild?: boolean;
}

const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ ratio = 1/1, style, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${ratio}`,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
