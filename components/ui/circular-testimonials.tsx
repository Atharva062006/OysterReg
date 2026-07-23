"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";

// Inline SVG Icons for 100% self-contained dependency-free reliability
function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 12H5" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export interface PlacementTestimonial {
  name: string;
  companyName: string;
  src: string;
  designation?: string;
  companyLogo?: string;
  quote?: string;
}

interface Colors {
  name?: string;
  company?: string;
  arrowBackground?: string;
  arrowForeground?: string;
  arrowHoverBackground?: string;
}

interface FontSizes {
  name?: string;
  company?: string;
}

interface CircularTestimonialsProps {
  testimonials: PlacementTestimonial[];
  autoplay?: boolean;
  colors?: Colors;
  fontSizes?: FontSizes;
}

function calculateGap(width: number) {
  const minWidth = 600;
  const maxWidth = 1200;
  const minGap = 45;
  const maxGap = 65;
  if (width <= minWidth) return minGap;
  if (width >= maxWidth) return maxGap;
  return minGap + (maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth));
}

export const CircularTestimonials = ({
  testimonials,
  autoplay = true,
  colors = {},
  fontSizes = {},
}: CircularTestimonialsProps) => {
  // Color & font config
  const colorName = colors.name ?? "#ffffff";
  const colorCompany = colors.company ?? "#f5a623";
  const colorArrowBg = colors.arrowBackground ?? "#1f1f23";
  const colorArrowFg = colors.arrowForeground ?? "#ffffff";
  const colorArrowHoverBg = colors.arrowHoverBackground ?? "#f5a623";
  const fontSizeName = fontSizes.name ?? "1.75rem";
  const fontSizeCompany = fontSizes.company ?? "1.15rem";

  // State
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isAnimating, setIsAnimating] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const testimonialsLength = useMemo(() => testimonials.length, [testimonials]);
  const activeTestimonial = useMemo(
    () => testimonials[activeIndex],
    [activeIndex, testimonials]
  );

  // Trigger smooth slow fade-in animation on slide change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 800);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  // Responsive gap calculation
  useEffect(() => {
    function handleResize() {
      if (imageContainerRef.current) {
        setContainerWidth(imageContainerRef.current.offsetWidth);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Autoplay (Slow 9-second interval)
  useEffect(() => {
    if (autoplay && testimonialsLength > 0) {
      autoplayIntervalRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % testimonialsLength);
      }, 9000);
    }
    return () => {
      if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
    };
  }, [autoplay, testimonialsLength]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonialsLength);
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
  }, [testimonialsLength]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + testimonialsLength) % testimonialsLength);
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
  }, [testimonialsLength]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleNext, handlePrev]);

  // Compute transforms for each image
  function getImageStyle(index: number): React.CSSProperties {
    const gap = calculateGap(containerWidth);
    const maxStickUp = gap * 0.7;
    const isActive = index === activeIndex;
    const isLeft = (activeIndex - 1 + testimonialsLength) % testimonialsLength === index;
    const isRight = (activeIndex + 1) % testimonialsLength === index;

    if (isActive) {
      return {
        zIndex: 3,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(0px) translateY(0px) scale(1) rotateY(0deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    if (isLeft) {
      return {
        zIndex: 2,
        opacity: 0.8,
        pointerEvents: "auto",
        transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(12deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    if (isRight) {
      return {
        zIndex: 2,
        opacity: 0.8,
        pointerEvents: "auto",
        transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(-12deg)`,
        transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
      };
    }
    return {
      zIndex: 1,
      opacity: 0,
      pointerEvents: "none",
      transform: `scale(0.7)`,
      transition: "all 0.8s cubic-bezier(.4,2,.3,1)",
    };
  }

  if (!testimonials || testimonials.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto p-2 sm:p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
        {/* Images Perspective Container */}
        <div
          className="relative w-full max-w-[260px] sm:max-w-[300px] h-[320px] sm:h-[360px] [perspective:1000px] flex items-center justify-center mx-auto"
          ref={imageContainerRef}
        >
          {testimonials.map((testimonial, index) => (
            <img
              key={`${testimonial.name}-${index}`}
              src={testimonial.src}
              alt={testimonial.name}
              className="absolute w-full h-full object-cover rounded-3xl shadow-2xl border-2 border-white/10"
              style={getImageStyle(index)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop`;
              }}
            />
          ))}
        </div>

        {/* Student Name & Plain Company Name Container */}
        <div className="flex flex-col justify-between space-y-6 sm:space-y-8">
          <div
            key={activeIndex}
            className={`flex flex-col gap-2 transition-all duration-700 ease-out ${
              isAnimating ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"
            }`}
          >
            {/* Placed Student Name */}
            <h3
              className="font-extrabold tracking-tight"
              style={{ color: colorName, fontSize: fontSizeName }}
            >
              {activeTestimonial.name}
            </h3>

            {/* Clean Company Name Text */}
            <p
              className="font-bold tracking-wide"
              style={{ color: colorCompany, fontSize: fontSizeCompany }}
            >
              {activeTestimonial.companyName}
            </p>

            {/* Optional Quote / Highlight */}
            {activeTestimonial.quote && (
              <p className="text-zinc-300 text-sm leading-relaxed mt-2 italic border-l-2 border-amber-500/50 pl-3">
                "{activeTestimonial.quote}"
              </p>
            )}
          </div>

          {/* Navigation Controls with Balanced Spacing */}
          <div className="flex items-center gap-4 pt-4 sm:pt-5 mt-6 sm:mt-8 border-t border-white/5">
            <button
              onClick={handlePrev}
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-md border border-white/10 hover:scale-110 active:scale-95"
              style={{
                backgroundColor: hoverPrev ? colorArrowHoverBg : colorArrowBg,
                color: colorArrowFg,
              }}
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => setHoverPrev(false)}
              aria-label="Previous placed student"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>

            <button
              onClick={handleNext}
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-md border border-white/10 hover:scale-110 active:scale-95"
              style={{
                backgroundColor: hoverNext ? colorArrowHoverBg : colorArrowBg,
                color: colorArrowFg,
              }}
              onMouseEnter={() => setHoverNext(true)}
              onMouseLeave={() => setHoverNext(false)}
              aria-label="Next placed student"
            >
              <ArrowRightIcon className="w-5 h-5" />
            </button>

            {/* Pagination dots indicator */}
            <div className="flex items-center gap-1.5 ml-4">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i === activeIndex ? "w-6 bg-amber-400" : "w-2 bg-white/20 hover:bg-white/40"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularTestimonials;
