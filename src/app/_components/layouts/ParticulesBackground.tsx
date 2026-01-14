'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useCommunityColors, CRAMERI_PALETTES, DEFAULT_PALETTE, SIGNIN_PALETTE } from '@/hooks/useCommunityColors';
import { usePathname } from 'next/navigation';

type MaskBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MaskEventDetail = {
  id: string;
  bounds: MaskBounds;
};

interface ParticulesBackgroundProps {
  maskSourceId?: string;
}

export function ParticulesBackground({ maskSourceId = 'global' }: ParticulesBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { colors } = useTheme();
  const communityColors = useCommunityColors();
  const [maskBounds, setMaskBounds] = useState<MaskBounds | null>(null);
  const pathname = usePathname();
  
  // Check if we're on the signin page
  const isSigninPage = pathname?.includes('/auth/signin');

  // useEffect(() => {
  //   if (typeof window === 'undefined') return;

  //   const handler = (event: Event) => {
  //     const customEvent = event as CustomEvent<MaskEventDetail>;
  //     if (customEvent.detail?.id === maskSourceId) {
  //       if (typeof process !== 'usndefined' && process.env.NODE_ENV !== 'production') {
  //         console.log('[ParticulesBackground] received mask bounds', maskSourceId, customEvent.detail.bounds);
  //       }
  //       setMaskBounds(customEvent.detail.bounds);
  //     }
  //   };

  //   window.addEventListener('particules:mask-update', handler as EventListener);
  //   return () => {
  //     window.removeEventListener('particules:mask-update', handler as EventListener);
  //   };
  // }, [maskSourceId]);
  
  // Get the 10 palette colors for particles
  // Use signin palette on signin page, otherwise use cookie colors if available
  const paletteColors = useMemo(() => {
    if (isSigninPage) {
      // Use signin palette with login button colors on signin page
      return CRAMERI_PALETTES[SIGNIN_PALETTE].colors;
    }
    if (communityColors.isLoaded) {
      // Return first 10 colors from the palette (from cookies)
      return communityColors.colors.slice(0, 10);
    }
    return CRAMERI_PALETTES[DEFAULT_PALETTE].colors;
  }, [communityColors.colors, communityColors.isLoaded, isSigninPage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Social graph particles with clustering
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      glitchOffset: number;
      type: 'hub' | 'node' | 'connector';
      clusterId: number;
      colorIndex: number; // Index into the 10 palette colors
      trail: Array<{ x: number; y: number; opacity: number }>;
    }

    interface Cluster {
      id: number;
      centerX: number;
      centerY: number;
      targetX: number;
      targetY: number;
      vx: number;
      vy: number;
      radius: number;
      innerRadius: number;
    }

    const particles: Particle[] = [];
    const clusters: Cluster[] = [];

    const BASE_TOTAL_PARTICLES =
      typeof window !== 'undefined' && window.innerWidth < 768 ? 100 : 400;
    let animationId: number | null = null;
    let time = 0;
    let isStaticMode = false;

    const getClusterConfigs = (width: number, height: number) => {
      const radius = Math.min(width * 0.45, height * 0.6);
      const isDesktop = width >= 1024;
      const fallbackInner = radius * (isDesktop ? 0.45 : 0.3);

      const centerX = maskBounds ? maskBounds.x + maskBounds.width / 2 : width / 2;
      const centerY = maskBounds ? maskBounds.y + maskBounds.height / 2 : height / 2;

      const maskRadius = maskBounds ? Math.max(maskBounds.width, maskBounds.height) * 0.6 : fallbackInner;
      const innerRadius = Math.min(radius * 0.95, Math.max(fallbackInner, maskRadius));

      return [{ id: 0, x: centerX, y: centerY, radius, innerRadius }];
    };

    const initializeSimulation = () => {
      clusters.length = 0;
      particles.length = 0;

      isStaticMode = window.innerWidth < 768;

      const configs = getClusterConfigs(canvas.width, canvas.height);
      const totalParticles = isStaticMode ? 100 : BASE_TOTAL_PARTICLES;

      configs.forEach((config) => {
        clusters.push({
          id: config.id,
          centerX: config.x,
          centerY: config.y,
          targetX: config.x,
          targetY: config.y,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          radius: config.radius,
          innerRadius: config.innerRadius
        });
      });

      const isDesktop = canvas.width >= 1024;
      let hubIndex = 0;

      configs.forEach((_, clusterIndex) => {
        const cluster = clusters[clusterIndex];
        const particlesForCluster =
          Math.floor(totalParticles / configs.length) +
          (clusterIndex < totalParticles % configs.length ? 1 : 0);

        for (let i = 0; i < particlesForCluster; i++) {
          const angle = Math.random() * Math.PI * 2;
          const ringDistance = cluster.innerRadius + Math.random() * (cluster.radius - cluster.innerRadius);
          const isHub = Math.random() < 0.15;

          let spawnX = cluster.centerX + Math.cos(angle) * ringDistance;
          let spawnY = cluster.centerY + Math.sin(angle) * ringDistance;

          if (isHub) {
            if (isDesktop) {
              const side = hubIndex % 2 === 0 ? -1 : 1;
              const anchorX = cluster.centerX + side * cluster.radius * 0.7;
              const anchorY = cluster.centerY + (Math.random() - 0.5) * cluster.radius * 0.35;
              spawnX = anchorX + (Math.random() - 0.5) * cluster.radius * 0.15;
              spawnY = anchorY + (Math.random() - 0.5) * cluster.radius * 0.15;
              hubIndex += 1;
            } else {
              spawnX = cluster.centerX + (Math.random() - 0.5) * cluster.radius * 0.8;
              spawnY = cluster.centerY - cluster.radius * 0.2 + Math.random() * cluster.radius * 0.4;
            }
          }

          particles.push({
            x: spawnX,
            y: spawnY,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: isHub ? Math.random() * 2 + 2 : Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.8 + 0.2,
            glitchOffset: Math.random() * 100,
            type: isHub ? 'hub' : (Math.random() < 0.2 ? 'connector' : 'node'),
            clusterId: clusterIndex,
            colorIndex: Math.floor(Math.random() * 10),
            trail: []
          });
        }
      });
    };

    const renderFrame = () => {
      time += 0.016;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Update cluster centers (slow drift)
      clusters.forEach(cluster => {
        cluster.vx += (cluster.targetX - cluster.centerX) * 0.0005;
        cluster.vy += (cluster.targetY - cluster.centerY) * 0.0005;

        cluster.centerX += cluster.vx;
        cluster.centerY += cluster.vy;

        cluster.vx *= 0.99;
        cluster.vy *= 0.99;

        // Keep in bounds
        cluster.centerX = Math.max(cluster.radius, Math.min(width - cluster.radius, cluster.centerX));
        cluster.centerY = Math.max(cluster.radius, Math.min(height - cluster.radius, cluster.centerY));
      });

      // Update particles with gravitational attraction to cluster center
      particles.forEach((particle, index) => {
        const cluster = clusters[particle.clusterId];
        
        // Gravitational pull towards cluster center (reduced for more dispersed look)
        const dx = cluster.centerX - particle.x;
        const dy = cluster.centerY - particle.y;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
        const attraction = 0.0002; // Reduced from 0.0008 for less contraction
        
        particle.vx += (dx / distance) * attraction;
        particle.vy += (dy / distance) * attraction;
        
        // Damping (reduced for more movement)
        particle.vx *= 0.96;
        particle.vy *= 0.96;
        
        // Add some orbital motion (increased for more spread)
        particle.vx += Math.sin(time * 0.5 + index) * 0.02;
        particle.vy += Math.cos(time * 0.5 + index) * 0.02;
        
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Add to trail
        particle.trail.push({ x: particle.x, y: particle.y, opacity: particle.opacity });
        if (particle.trail.length > 8) {
          particle.trail.shift();
        }

        // Repel from inner core to keep center clear
        if (distance < cluster.innerRadius) {
          const repulsion = (cluster.innerRadius - distance) * 0.0008;
          particle.vx -= (dx / distance) * repulsion;
          particle.vy -= (dy / distance) * repulsion;
        }

        // Keep particles in cluster bounds (increased max distance)
        const maxDist = cluster.radius * 1.8;
        if (distance > maxDist) {
          const angle = Math.atan2(dy, dx);
          particle.x = cluster.centerX + Math.cos(angle) * maxDist;
          particle.y = cluster.centerY + Math.sin(angle) * maxDist;
          particle.vx *= -0.5;
          particle.vy *= -0.5;
        }
      });

      // Draw connections between nearby particles (edges)
      const connectionDistance = 120;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          
          // Only connect particles in same cluster
          if (p1.clusterId !== p2.clusterId) continue;
          
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < connectionDistance) {
            const opacity = (1 - dist / connectionDistance) * 0.3;
            ctx.save();
            // Use color of the hub particle, or blend colors for regular connections
            const edgeColor = p1.type === 'hub' ? paletteColors[p1.colorIndex] : paletteColors[p2.colorIndex];
            ctx.strokeStyle = edgeColor;
            ctx.globalAlpha = opacity;
            ctx.lineWidth = p1.type === 'hub' || p2.type === 'hub' ? 1.5 : 0.8;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Draw particles
      particles.forEach((particle) => {
        const particleColor = paletteColors[particle.colorIndex];
        
        // Draw trail
        particle.trail.forEach((point, trailIndex) => {
          ctx.save();
          ctx.globalAlpha = point.opacity * (trailIndex / particle.trail.length) * 0.2;
          ctx.fillStyle = particleColor;
          ctx.beginPath();
          ctx.arc(point.x, point.y, particle.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        ctx.save();
        ctx.globalAlpha = particle.opacity * (0.7 + Math.sin(time * 3) * 0.3);
        
        // Use particle's assigned color from palette
        ctx.fillStyle = particleColor;
        ctx.shadowBlur = particle.type === 'hub' ? 20 : (particle.type === 'connector' ? 15 : 12);
        ctx.shadowColor = particleColor;
        
        // Draw particle as circle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });
    };

    const step = () => {
      renderFrame();
      animationId = requestAnimationFrame(step);
    };

    const startSimulation = () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      time = 0;
      initializeSimulation();
      if (isStaticMode) {
        // Render a single frame for mobile to keep particles static
        renderFrame();
      } else {
        step();
      }
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      startSimulation();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [paletteColors, maskBounds]);

  return (
    <div className="fixed inset-0 w-screen h-screen pointer-events-none z-0">
      <div 
        className="absolute inset-0 w-full h-full"
        style={{ 
          backgroundColor: colors.background,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0, 123, 255, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 0, 127, 0.03) 0%, transparent 50%)'
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
}