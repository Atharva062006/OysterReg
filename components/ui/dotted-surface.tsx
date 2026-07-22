'use client';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'>;

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
	const theme = "dark";

	const containerRef = useRef<HTMLDivElement>(null);
	const sceneRef = useRef<{
		scene: THREE.Scene;
		camera: THREE.PerspectiveCamera;
		renderer: THREE.WebGLRenderer;
		particles: THREE.Points[];
		animationId: number;
		count: number;
	} | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const SEPARATION = 150;
		const AMOUNTX = 40;
		const AMOUNTY = 60;

		// Brand gradient stops: orange #f5a623 → coral #f0603a → hot pink #e91e8c
		const gradientStops = [
			{ r: 245, g: 166, b: 35 },  // #f5a623 orange
			{ r: 240, g: 96,  b: 58 },  // #f0603a coral
			{ r: 233, g: 30,  b: 140 }, // #e91e8c hot pink
		];

		function gradientColor(t: number) {
			// t is 0..1, map across two segments
			if (t < 0.5) {
				const s = t / 0.5;
				return {
					r: gradientStops[0].r + (gradientStops[1].r - gradientStops[0].r) * s,
					g: gradientStops[0].g + (gradientStops[1].g - gradientStops[0].g) * s,
					b: gradientStops[0].b + (gradientStops[1].b - gradientStops[0].b) * s,
				};
			} else {
				const s = (t - 0.5) / 0.5;
				return {
					r: gradientStops[1].r + (gradientStops[2].r - gradientStops[1].r) * s,
					g: gradientStops[1].g + (gradientStops[2].g - gradientStops[1].g) * s,
					b: gradientStops[1].b + (gradientStops[2].b - gradientStops[1].b) * s,
				};
			}
		}

		// Scene setup
		const scene = new THREE.Scene();
		scene.fog = new THREE.Fog(0x0c0c0e, 2000, 10000);

		const camera = new THREE.PerspectiveCamera(
			60,
			window.innerWidth / window.innerHeight,
			1,
			10000,
		);
		camera.position.set(0, 355, 1220);

		const renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true,
		});
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(0x000000, 0);

		containerRef.current.appendChild(renderer.domElement);

		// Create geometry for all particles
		const geometry = new THREE.BufferGeometry();
		const totalParticles = AMOUNTX * AMOUNTY;

		const positions = new Float32Array(totalParticles * 3);
		const colors = new Float32Array(totalParticles * 3);

		let i = 0;
		for (let ix = 0; ix < AMOUNTX; ix++) {
			for (let iy = 0; iy < AMOUNTY; iy++) {
				const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
				const y = 0;
				const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

				positions[i * 3]     = x;
				positions[i * 3 + 1] = y;
				positions[i * 3 + 2] = z;

				// Gradient based on x position (left to right = orange to hot pink)
				const t = ix / (AMOUNTX - 1);
				const col = gradientColor(t);
				colors[i * 3]     = col.r / 255;
				colors[i * 3 + 1] = col.g / 255;
				colors[i * 3 + 2] = col.b / 255;

				i++;
			}
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		// Create material
		const material = new THREE.PointsMaterial({
			size: 7,
			vertexColors: true,
			transparent: true,
			opacity: 0.85,
			sizeAttenuation: true,
		});

		// Create points object
		const points = new THREE.Points(geometry, material);
		scene.add(points);

		let count = 0;
		let animationId: number = 0;

		// Animation function
		const animate = () => {
			animationId = requestAnimationFrame(animate);

			const positionAttribute = geometry.attributes.position;
			const posArr = positionAttribute.array as Float32Array;

			let idx = 0;
			for (let ix = 0; ix < AMOUNTX; ix++) {
				for (let iy = 0; iy < AMOUNTY; iy++) {
					posArr[idx * 3 + 1] =
						Math.sin((ix + count) * 0.3) * 50 +
						Math.sin((iy + count) * 0.5) * 50;
					idx++;
				}
			}

			positionAttribute.needsUpdate = true;
			renderer.render(scene, camera);
			count += 0.1;
		};

		// Handle window resize
		const handleResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};

		window.addEventListener('resize', handleResize);

		// Start animation
		animate();

		// Store references
		sceneRef.current = {
			scene,
			camera,
			renderer,
			particles: [points],
			animationId,
			count,
		};

		// Cleanup function
		return () => {
			window.removeEventListener('resize', handleResize);

			if (sceneRef.current) {
				cancelAnimationFrame(sceneRef.current.animationId);

				sceneRef.current.scene.traverse((object) => {
					if (object instanceof THREE.Points) {
						object.geometry.dispose();
						if (Array.isArray(object.material)) {
							object.material.forEach((m) => m.dispose());
						} else {
							object.material.dispose();
						}
					}
				});

				sceneRef.current.renderer.dispose();

				if (containerRef.current && sceneRef.current.renderer.domElement) {
					containerRef.current.removeChild(
						sceneRef.current.renderer.domElement,
					);
				}
			}
		};
	}, [theme]);

	return (
		<div
			ref={containerRef}
			className={cn('pointer-events-none fixed inset-0 z-0', className)}
			{...props}
		/>
	);
}
