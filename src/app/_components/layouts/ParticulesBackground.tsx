'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';

export function ParticulesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { colors } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

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
      trail: Array<{ x: number; y: number; opacity: number }>;
    }

    interface Cluster {
      id: number;
      centerX: number;
      centerY: number;
      vx: number;
      vy: number;
      radius: number;
    }

    const particles: Particle[] = [];
    const clusters: Cluster[] = [];

    // Create single large cluster (social community)
    const mainCluster: Cluster = {
      id: 0,
      centerX: canvas.width / 2,
      centerY: canvas.height / 2,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      radius: 500
    };
    clusters.push(mainCluster);

    // Initialize 250 particles in the main cluster
    for (let i = 0; i < 250; i++) {
      // Distribute particles around cluster center
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * mainCluster.radius;
      const isHub = Math.random() < 0.15; // 15% are hub nodes
      
      particles.push({
        x: mainCluster.centerX + Math.cos(angle) * distance,
        y: mainCluster.centerY + Math.sin(angle) * distance,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: isHub ? Math.random() * 2 + 2 : Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.8 + 0.2,
        glitchOffset: Math.random() * 100,
        type: isHub ? 'hub' : (Math.random() < 0.2 ? 'connector' : 'node'),
        clusterId: 0,
        trail: []
      });
    }

    let animationId: number;
    let time = 0;

    const animate = () => {
      time += 0.016;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Update cluster centers (slow drift)
      clusters.forEach(cluster => {
        cluster.centerX += cluster.vx;
        cluster.centerY += cluster.vy;

        // Bounce off edges
        if (cluster.centerX < cluster.radius || cluster.centerX > width - cluster.radius) {
          cluster.vx *= -1;
        }
        if (cluster.centerY < cluster.radius || cluster.centerY > height - cluster.radius) {
          cluster.vy *= -1;
        }

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
        const distance = Math.sqrt(dx * dx + dy * dy);
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

        // Keep particles in cluster bounds (increased max distance)
        const maxDist = cluster.radius * 2.2;
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
            ctx.strokeStyle = p1.type === 'hub' || p2.type === 'hub' ? '#d6356f' : '#2a39a9';
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
        // Draw trail
        particle.trail.forEach((point, trailIndex) => {
          ctx.save();
          ctx.globalAlpha = point.opacity * (trailIndex / particle.trail.length) * 0.2;
          ctx.fillStyle = particle.type === 'hub' ? '#d6356f' : '#2a39a9';
          ctx.beginPath();
          ctx.arc(point.x, point.y, particle.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        ctx.save();
        ctx.globalAlpha = particle.opacity * (0.7 + Math.sin(time * 3) * 0.3);
        
        // Color by type
        if (particle.type === 'hub') {
          ctx.fillStyle = '#d6356f';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#d6356f';
        } else if (particle.type === 'connector') {
          ctx.fillStyle = '#ff9d00';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#ff9d00';
        } else {
          ctx.fillStyle = '#2a39a9';
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#2a39a9';
        }
        
        // Draw particle as circle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <div 
        className="absolute inset-0"
        style={{ 
          backgroundColor: colors.background,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0, 123, 255, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 0, 127, 0.03) 0%, transparent 50%)'
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
    </div>
  );
}