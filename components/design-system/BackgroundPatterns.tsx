"use client";

import { cn } from "@/lib/utils";

type PatternVariant =
  | "mesh"
  | "grid"
  | "dots"
  | "lines"
  | "waves"
  | "noise"
  | "hexagon"
  | "circuit"
  | "radial";

type PortalTheme = "public" | "student" | "faculty" | "admin";

interface BackgroundPatternProps {
  variant: PatternVariant;
  portal?: PortalTheme;
  opacity?: number;
  className?: string;
  animate?: boolean;
  intensity?: "subtle" | "medium" | "strong";
  colors?: string[];
  size?: number;
  angle?: number;
}

const PORTAL_COLORS: Record<PortalTheme, string[]> = {
  public: ["#1746B8", "#0A1D50", "#D4AF37"],
  student: ["#1746B8", "#D4AF37", "#0A1D50"],
  faculty: ["#0A1D50", "#1746B8", "#D4AF37"],
  admin: ["#0A1D50", "#1746B8", "#D4AF37"],
};

function getPortalColors(portal: PortalTheme, customColors?: string[]): string[] {
  return customColors || PORTAL_COLORS[portal] || PORTAL_COLORS.public;
}

function getOpacity(opacity?: number, intensity?: "subtle" | "medium" | "strong"): number {
  if (opacity !== undefined) return opacity;
  switch (intensity) {
    case "subtle": return 0.03;
    case "medium": return 0.06;
    case "strong": return 0.1;
    default: return 0.05;
  }
}

// ---------------------------------------------------------------------------
// METALLIC MESH GRADIENT
// ---------------------------------------------------------------------------

export function MetallicMesh({
  portal = "public",
  opacity = 0.04,
  animate = true,
  className,
  intensity = "medium",
  colors: customColors,
}: BackgroundPatternProps) {
  const colors = getPortalColors(portal, customColors);
  const op = getOpacity(opacity, intensity);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        animate && "animate-gradient-shift",
        className
      )}
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 20%, ${colors[0]}22 0%, transparent 50%),
          radial-gradient(ellipse 60% 40% at 80% 80%, ${colors[1]}22 0%, transparent 50%),
          radial-gradient(ellipse 40% 60% at 50% 10%, ${colors[2]}1a 0%, transparent 50%),
          radial-gradient(ellipse 50% 30% at 10% 90%, ${colors[0]}15 0%, transparent 50%),
          radial-gradient(ellipse 70% 50% at 90% 30%, ${colors[1]}15 0%, transparent 50%)
        `,
        opacity: op,
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// SUBTLE GRID PATTERN
// ---------------------------------------------------------------------------

export function GridPattern({
  portal = "public",
  opacity = 0.02,
  size = 48,
  className,
  animate = false,
  intensity = "subtle",
}: BackgroundPatternProps) {
  const colors = getPortalColors(portal);
  const op = getOpacity(opacity, intensity);
  const primaryColor = colors[0];

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        animate && "animate-grid-pulse",
        className
      )}
      style={{
        backgroundImage: `
          linear-gradient(${primaryColor}${Math.round(op * 255).toString(16).padStart(2, "0")} 1px, transparent 1px),
          linear-gradient(90deg, ${primaryColor}${Math.round(op * 255).toString(16).padStart(2, "0")} 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`,
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// DOT GRID PATTERN
// ---------------------------------------------------------------------------

export function DotPattern({
  portal = "public",
  opacity = 0.025,
  size = 32,
  className,
  animate = false,
  intensity = "subtle",
}: BackgroundPatternProps) {
  const colors = getPortalColors(portal);
  const op = getOpacity(opacity, intensity);
  const primaryColor = colors[0];

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        animate && "animate-dot-pulse",
        className
      )}
      style={{
        backgroundImage: `radial-gradient(circle at center, ${primaryColor}${Math.round(op * 255).toString(16).padStart(2, "0")} 1.5px, transparent 1.5px)`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: "center center",
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// DIAGONAL LINES PATTERN
// ---------------------------------------------------------------------------

export function DiagonalLines({
  portal = "public",
  opacity = 0.015,
  size = 64,
  angle = 45,
  className,
  animate = false,
  intensity = "subtle",
}: BackgroundPatternProps) {
  const colors = getPortalColors(portal);
  const op = getOpacity(opacity, intensity);
  const primaryColor = colors[0];

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        animate && "animate-diagonal-shift",
        className
      )}
      style={{
        backgroundImage: `repeating-linear-gradient(
          ${angle}deg,
          ${primaryColor}${Math.round(op * 255).toString(16).padStart(2, "0")},
          ${primaryColor}${Math.round(op * 255).toString(16).padStart(2, "0")} 1px,
          transparent 1px,
          transparent ${size}px
        )`,
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// ORGANIC WAVES PATTERN
// ---------------------------------------------------------------------------

export function WavePattern({
  portal = "public",
  opacity = 0.03,
  className,
  animate = true,
  intensity = "medium",
  colors: customColors,
}: BackgroundPatternProps) {
  const colors = getPortalColors(portal, customColors);
  const op = getOpacity(opacity, intensity);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        animate && "animate-wave-flow",
        className
      )}
      style={{
        background: `
          linear-gradient(180deg,
            transparent 0%,
            ${colors[0]}${Math.round(op * 0.3 * 255).toString(16).padStart(2, "0")} 20%,
            transparent 40%,
            ${colors[1]}${Math.round(op * 0.2 * 255).toString(16).padStart(2, "0")} 60%,
            transparent 80%,
            ${colors[2]}${Math.round(op * 0.25 * 255).toString(16).padStart(2, "0")} 100%
          )
        `,
        backgroundSize: "100% 300%",
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// NOISE TEXTURE
// ---------------------------------------------------------------------------

export function NoisePattern({
  opacity = 0.01,
  className,
  intensity = "subtle",
}: BackgroundPatternProps) {
  const op = getOpacity(opacity, intensity);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        opacity: op,
        mixBlendMode: "overlay",
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// HEXAGON GRID PATTERN
// ---------------------------------------------------------------------------

export function HexagonPattern({
  portal = "public",
  opacity = 0.02,
  size = 48,
  className,
  animate = false,
  intensity = "subtle",
}: BackgroundPatternProps) {
  const colors = getPortalColors(portal);
  const op = getOpacity(opacity, intensity);
  const primaryColor = colors[0];

  // SVG hexagon pattern
  const hexagonSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size * 1.732}" height="${size * 1.5}" viewBox="0 0 ${size * 1.732} ${size * 1.5}">
      <defs>
        <pattern id="hex-grid" width="${size * 1.732}" height="${size * 1.5}" patternUnits="userSpaceOnUse">
          <path d="M${size * 0.866},0 L${size * 1.732},${size * 0.375} L${size * 1.732},${size * 1.125} L${size * 0.866},${size * 1.5} L0,${size * 1.125} L0,${size * 0.375} Z" 
                fill="none" stroke="${primaryColor}" stroke-width="0.5" stroke-opacity="${op}"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(%23hex-grid)"/>
    </svg>
  `;

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        animate && "animate-hex-pulse",
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(hexagonSvg)}")`,
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// CIRCUIT BOARD PATTERN (Tech/Academic feel)
// ---------------------------------------------------------------------------

export function CircuitPattern({
  portal = "admin",
  opacity = 0.015,
  className,
  animate = false,
  intensity = "subtle",
}: BackgroundPatternProps) {
  const colors = getPortalColors(portal);
  const op = getOpacity(opacity, intensity);
  const primaryColor = colors[0];

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        animate && "animate-circuit-flow",
        className
      )}
      style={{
        backgroundImage: `
          linear-gradient(90deg, ${primaryColor}${Math.round(op * 255).toString(16).padStart(2, "0")} 1px, transparent 1px),
          linear-gradient(${primaryColor}${Math.round(op * 255).toString(16).padStart(2, "0")} 1px, transparent 1px),
          radial-gradient(circle at 25% 25%, ${primaryColor}${Math.round(op * 0.5 * 255).toString(16).padStart(2, "0")} 3px, transparent 3px),
          radial-gradient(circle at 75% 75%, ${primaryColor}${Math.round(op * 0.5 * 255).toString(16).padStart(2, "0")} 3px, transparent 3px)
        `,
        backgroundSize: "60px 60px, 60px 60px, 120px 120px, 120px 120px",
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// RADIAL BURST PATTERN
// ---------------------------------------------------------------------------

export function RadialBurst({
  portal = "public",
  opacity = 0.025,
  className,
  animate = true,
  intensity = "medium",
  colors: customColors,
}: BackgroundPatternProps) {
  const colors = getPortalColors(portal, customColors);
  const op = getOpacity(opacity, intensity);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        animate && "animate-radial-rotate",
        className
      )}
      style={{
        background: `
          radial-gradient(ellipse at 20% 20%, ${colors[0]}${Math.round(op * 255).toString(16).padStart(2, "0")} 0%, transparent 40%),
          radial-gradient(ellipse at 80% 80%, ${colors[1]}${Math.round(op * 255).toString(16).padStart(2, "0")} 0%, transparent 40%),
          radial-gradient(ellipse at 50% 50%, ${colors[2]}${Math.round(op * 0.15 * 255).toString(16).padStart(2, "0")} 0%, transparent 60%)
        `,
        backgroundSize: "200% 200%",
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// COMPOSITE BACKGROUND — Combines multiple patterns
// ---------------------------------------------------------------------------

interface CompositeBackgroundProps {
  portal?: PortalTheme;
  className?: string;
  baseOpacity?: number;
  patterns?: Array<{
    variant: PatternVariant;
    opacity?: number;
    intensity?: "subtle" | "medium" | "strong";
    animate?: boolean;
    colors?: string[];
    angle?: number;
  }>;
}

const PATTERN_COMPONENTS: Record<PatternVariant, React.FC<BackgroundPatternProps>> = {
  mesh: MetallicMesh,
  grid: GridPattern,
  dots: DotPattern,
  lines: DiagonalLines,
  waves: WavePattern,
  noise: NoisePattern,
  hexagon: HexagonPattern,
  circuit: CircuitPattern,
  radial: RadialBurst,
};

export function CompositeBackground({
  portal = "public",
  className,
  baseOpacity = 1,
  patterns = [
    { variant: "mesh", intensity: "medium", animate: true },
    { variant: "dots", intensity: "subtle", animate: false },
    { variant: "noise", intensity: "subtle", animate: false },
  ],
}: CompositeBackgroundProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)} style={{ opacity: baseOpacity }} aria-hidden="true">
      {patterns.map((pattern, index) => {
        const Component = PATTERN_COMPONENTS[pattern.variant];
        if (!Component) return null;
        return (
          <Component
            key={`${pattern.variant}-${index}`}
            variant={pattern.variant}
            portal={portal}
            opacity={pattern.opacity}
            intensity={pattern.intensity}
            animate={pattern.animate}
            colors={pattern.colors}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PORTAL-SPECIFIC BACKGROUND PRESETS
// ---------------------------------------------------------------------------

export function PublicBackground({ className }: { className?: string }) {
  return (
    <CompositeBackground
      portal="public"
      className={className}
      patterns={[
        { variant: "mesh", intensity: "medium", animate: true },
        { variant: "dots", intensity: "subtle", animate: false },
        { variant: "waves", intensity: "subtle", animate: true },
        { variant: "noise", intensity: "subtle", animate: false },
      ]}
    />
  );
}

export function StudentBackground({ className }: { className?: string }) {
  return (
    <CompositeBackground
      portal="student"
      className={className}
      patterns={[
        { variant: "radial", intensity: "medium", animate: true, colors: ["#7c2d12", "#ca8a04", "#eab308"] },
        { variant: "dots", intensity: "medium", animate: true },
        { variant: "waves", intensity: "subtle", animate: true },
        { variant: "noise", intensity: "subtle", animate: false },
      ]}
    />
  );
}

export function FacultyBackground({ className }: { className?: string }) {
  return (
    <CompositeBackground
      portal="faculty"
      className={className}
      patterns={[
        { variant: "mesh", intensity: "medium", animate: true },
        { variant: "lines", intensity: "subtle", animate: false, angle: 30 },
        { variant: "dots", intensity: "subtle", animate: false },
        { variant: "noise", intensity: "subtle", animate: false },
      ]}
    />
  );
}

export function AdminBackground({ className }: { className?: string }) {
  return (
    <CompositeBackground
      portal="admin"
      className={className}
      patterns={[
        { variant: "circuit", intensity: "medium", animate: true },
        { variant: "grid", intensity: "subtle", animate: false },
        { variant: "hexagon", intensity: "subtle", animate: true },
        { variant: "noise", intensity: "subtle", animate: false },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// PAGE SECTION BACKGROUND WRAPPER
// ---------------------------------------------------------------------------

interface SectionBackgroundProps {
  children: React.ReactNode;
  portal?: PortalTheme;
  pattern?: PatternVariant;
  className?: string;
  opacity?: number;
}

export function SectionBackground({
  children,
  portal = "public",
  pattern = "mesh",
  className,
  opacity,
}: SectionBackgroundProps) {
  const PatternComponent = PATTERN_COMPONENTS[pattern] || MetallicMesh;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <PatternComponent variant={pattern} portal={portal} opacity={opacity} animate={true} intensity="medium" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
