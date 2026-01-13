'use client';

import { useTheme } from '@/hooks/useTheme';
import { useCommunityColors } from '@/hooks/useCommunityColors';

interface LoadingIndicatorProps {
  msg: string;
  textSize?: 'sm' | 'base';
  color?: string; // Custom color from palette (overrides auto-detection)
}

export default function LoadingIndicator({ msg, textSize = 'sm', color }: LoadingIndicatorProps) {
  const { isDark } = useTheme();
  const { colors: communityColors } = useCommunityColors();
  
  // Use community colors from cookie/palette if no custom color provided
  // For contrast: use light color on dark theme, dark color on light theme
  const paletteColor = isDark 
    ? (communityColors[9] || communityColors[8] || '#fad541')
    : (communityColors[0] || communityColors[1] || '#011959');
  
  const spinnerColor = color || paletteColor;
  const textColor = color || paletteColor;
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        className="w-10 h-10 border-3 rounded-full animate-spin" 
        style={{ 
          borderLeftColor: spinnerColor,
          borderRightColor: spinnerColor,
          borderBottomColor: spinnerColor,
          borderTopColor: 'transparent'
        }}
      />
      <p 
        className={`font-mono tracking-wider ${textSize === 'base' ? 'text-base' : 'text-sm'}`}
        style={{ color: textColor }}
      >
        {msg}
      </p>
    </div>
  );
}