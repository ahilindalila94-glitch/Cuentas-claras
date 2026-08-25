import React, { useState } from 'react';
import brandLogoImg from '../assets/images/logo_ahilin_torres_1787628274548.jpg';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = 'w-full h-full object-contain aspect-square', 
  size 
}) => {
  const [imageLoaded, setImageLoaded] = useState(true);

  // If raster image loads cleanly, render high-res image with aspect ratio preservation
  if (imageLoaded) {
    return (
      <img
        src={brandLogoImg}
        alt="Estudio Ahilin Torres - Asesoría Contable"
        width={size}
        height={size}
        onError={() => setImageLoaded(false)}
        className={`aspect-square object-contain select-none rounded-full ${className}`}
        style={size ? { width: `${size}px`, height: `${size}px` } : undefined}
        loading="eager"
      />
    );
  }

  // Pixel-perfect vector SVG recreation identical to brand identity
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 400 400" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className={`aspect-square object-contain select-none ${className}`}
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
    >
      {/* Outer Purple Circle */}
      <circle cx="200" cy="200" r="186" stroke="#9868A7" strokeWidth="7.5" fill="#FFFFFF" />
      {/* Inner Thin Purple Circle */}
      <circle cx="200" cy="200" r="176" stroke="#9868A7" strokeWidth="2" />

      {/* Main Monogram Group */}
      <g id="monogram" fill="#222222">
        {/* Top serif wedge of 't' */}
        <polygon points="172,76 210,76 198,110 172,110" />
        
        {/* Horizontal Crossbar of 't' */}
        <polygon points="132,110 248,110 248,122 132,122" />

        {/* Stem and bottom swooping hook of 't' */}
        <path 
          d="M 174,122 
             L 208,122 
             L 208,198 
             C 208,228 226,242 254,242 
             C 264,242 272,239 278,235 
             C 266,240 250,238 242,229 
             C 234,220 234,204 234,186 
             L 234,122 
             L 174,122 Z" 
        />
        
        {/* Outer bottom tail swoop */}
        <path 
          d="M 174,122 
             L 208,122 
             L 208,212 
             C 208,236 230,250 264,250 
             C 275,250 284,247 290,243 
             C 276,252 248,252 232,240 
             C 214,227 210,210 210,195 
             L 210,122 
             Z" 
        />

        {/* The 'a' loop and bowl on the left */}
        <path 
          d="M 174,136 
             C 142,136 108,152 94,178 
             C 80,204 84,234 106,250 
             C 126,264 156,260 174,240 
             C 174,240 176,245 180,248 
             C 162,250 144,246 132,238 
             C 120,230 116,216 118,202 
             C 122,184 138,170 162,166 
             C 170,165 174,164 174,164 
             Z" 
        />

        {/* Lower inner counter of 'a' */}
        <path 
          d="M 174,220 
             C 174,234 154,242 136,236 
             C 120,230 110,214 110,196 
             C 110,174 124,156 148,156 
             C 162,156 174,165 174,178 
             C 174,160 160,148 142,148 
             C 116,148 98,168 98,195 
             C 98,224 120,244 148,244 
             C 162,244 174,237 174,228 
             Z" 
        />
      </g>

      {/* Two Botanical Leaves on the right of 't' stem */}
      {/* 1. Olive / Sage Green Leaf (Upper) */}
      <g id="green-leaf">
        <path 
          d="M 224,222 
             C 224,222 222,178 252,148 
             C 266,134 270,140 266,148 
             C 260,168 244,202 224,222 Z" 
          fill="#728148" 
        />
        <path 
          d="M 225,220 Q 240,190 258,154" 
          stroke="#556333" 
          strokeWidth="1.6" 
          strokeLinecap="round" 
        />
      </g>

      {/* 2. Soft Lilac / Violet Leaf (Lower) */}
      <g id="violet-leaf">
        <path 
          d="M 226,226 
             C 226,226 238,204 270,198 
             C 286,195 282,205 276,212 
             C 262,226 242,234 226,226 Z" 
          fill="#A47BB6" 
        />
        <path 
          d="M 228,224 Q 252,217 274,206" 
          stroke="#855B97" 
          strokeWidth="1.6" 
          strokeLinecap="round" 
        />
      </g>

      {/* Typography: AHILIN TORRES */}
      <text 
        x="200" 
        y="288" 
        textAnchor="middle" 
        fill="#222222" 
        fontFamily="Playfair Display, Georgia, 'Times New Roman', serif" 
        fontSize="26" 
        fontWeight="700" 
        letterSpacing="7.5"
      >
        AHILIN TORRES
      </text>

      {/* Subtitle: — ASESORÍA CONTABLE — */}
      <line x1="68" y1="308" x2="104" y2="308" stroke="#9868A7" strokeWidth="2.2" strokeLinecap="round" />
      
      <text 
        x="200" 
        y="313" 
        textAnchor="middle" 
        fill="#4A4A4A" 
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        fontSize="14" 
        fontWeight="600" 
        letterSpacing="5.2"
      >
        ASESORÍA CONTABLE
      </text>
      
      <line x1="296" y1="308" x2="332" y2="308" stroke="#9868A7" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};
