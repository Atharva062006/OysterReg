'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export interface GalleryItem {
	id: string | number;
	alt: string;
	src: string;
	aspectRatio?: number;
	placeholder?: string;
	title?: string;
}

interface ImageGalleryProps {
	items?: GalleryItem[];
	className?: string;
}

function useScrollReveal(threshold = 0.05) {
	const ref = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element || typeof IntersectionObserver === 'undefined') {
			setIsVisible(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.unobserve(entry.target);
				}
			},
			{ threshold }
		);

		observer.observe(element);
		return () => observer.disconnect();
	}, [threshold]);

	return { ref, isVisible };
}

export function ImageGallery({ items, className }: ImageGalleryProps) {
	if (!items || items.length === 0) return null;

	return (
		<div className={cn("relative flex w-full flex-col gap-4 py-2", className)}>
			{/* Photo Grid with Ultra-Smooth Cubic-Bezier Hover Effect */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{items.map((item, index) => (
					<PhotoCard
						key={item.id}
						item={item}
						index={index}
					/>
				))}
			</div>
		</div>
	);
}

interface PhotoCardProps {
	item: GalleryItem;
	index: number;
}

function PhotoCard({ item, index }: PhotoCardProps) {
	const { ref, isVisible } = useScrollReveal(0.05);
	const [imgSrc, setImgSrc] = useState(item.src);

	const handleError = () => {
		if (item.placeholder) {
			setImgSrc(item.placeholder);
		} else {
			setImgSrc(`https://placehold.co/1200x800/18181b/ffffff?text=${encodeURIComponent(item.title || 'Event Photo')}`);
		}
	};

	return (
		<div
			ref={ref}
			style={{
				transitionDelay: `${(index % 3) * 120}ms`,
				transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
			}}
			className={cn(
				"group relative rounded-xl overflow-hidden border border-neutral-800/80 bg-neutral-900 shadow-md transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] select-none min-h-[160px] hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(245,166,35,0.18)] will-change-transform transform-gpu",
				isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"
			)}
		>
			<AspectRatio ratio={item.aspectRatio || 16 / 10} className="bg-neutral-900 relative overflow-hidden size-full">
				<img
					alt={item.alt}
					src={imgSrc}
					onError={handleError}
					loading="lazy"
					style={{
						transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
					}}
					className="size-full object-cover opacity-100 transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 block will-change-transform transform-gpu"
				/>
			</AspectRatio>
		</div>
	);
}
