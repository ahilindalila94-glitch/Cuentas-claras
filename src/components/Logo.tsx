import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 48 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 300 300" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Thick Purple Circle */}
      <circle cx="150" cy="150" r="138" stroke="#9d73b0" strokeWidth="5.5" />
      {/* Inner Thin Purple Circle */}
      <circle cx="150" cy="150" r="131" stroke="#9d73b0" strokeWidth="1.5" />
      
      {/* Background container white */}
      <circle cx="150" cy="150" r="129" fill="#ffffff" />

      {/* Styled Monogram "a" and "t" */}
      <g transform="translate(0, -8)">
        {/* Horizontal crossbar of "t" */}
        <path 
          d="M 105,92 L 205,92 C 190,92 195,88 190,88 L 110,88 C 110,88 105,92 105,92 Z" 
          fill="#2d2d2d" 
        />
        <path 
          d="M 112,92 L 198,92 L 194,96 L 116,96 Z" 
          fill="#2d2d2d" 
        />
        
        {/* Vertical/curved main body of "t" */}
        <path 
          d="M 175,60 
             C 175,60 178,72 170,82 
             C 162,92 153,105 152,125 
             L 152,175 
             C 152,192 165,198 185,198 
             C 192,198 198,196 204,193 
             C 194,196 182,194 178,188 
             C 172,180 172,165 172,150 
             L 172,110 
             L 165,110 
             L 165,100 
             L 172,100 
             L 172,82 
             Z" 
          fill="#2d2d2d" 
        />

        {/* The elegant cursive "a" */}
        <path 
          d="M 150,116 
             C 130,116 112,124 103,142 
             C 94,160 95,182 110,195 
             C 122,205 142,203 151,192 
             C 151,192 152,195 155,198
             C 142,198 130,194 122,188
             C 114,182 112,170 114,158
             C 116,144 128,132 144,128
             C 148,127 151,126 151,126
             Z" 
          fill="#2d2d2d" 
        />
        
        {/* Connecting swoop for curve on monogram bottom-left */}
        <path 
          d="M 152,180
             C 152,192 135,196 122,192
             C 110,188 102,175 102,160
             C 102,142 114,128 132,128
             C 144,128 152,135 152,145
             C 152,130 142,120 128,120
             C 108,120 94,136 94,158
             C 94,182 112,199 135,199
             C 145,199 152,194 152,188
             Z"
          fill="#2d2d2d"
        />

        {/* Two beautiful leaves on the right */}
        {/* 1. Sage Green Leaf */}
        <path 
          d="M 183,180 
             C 183,180 181,148 202,125 
             C 214,112 216,118 214,124 
             C 210,140 198,166 183,180 Z" 
          fill="#6b7c4a" 
        />
        <path 
          d="M 184,178 Q 194,158 207,131" 
          stroke="#55633a" 
          strokeWidth="1.2" 
          strokeLinecap="round" 
        />

        {/* 2. Lavender Purple Leaf */}
        <path 
          d="M 185,183
             C 185,183 194,166 218,162
             C 232,160 228,168 223,174
             C 212,186 198,191 185,183 Z" 
          fill="#a57cb8" 
        />
        <path 
          d="M 187,181 Q 205,176 221,168" 
          stroke="#825c94" 
          strokeWidth="1.2" 
          strokeLinecap="round" 
        />
        
        {/* Stem line */}
        <path 
          d="M 181,185 L 186,177" 
          stroke="#2d2d2d" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
        />
      </g>

      {/* Subtitle brand name: AHILIN TORRES */}
      <text 
        x="150" 
        y="222" 
        textAnchor="middle" 
        fill="#262626" 
        fontFamily="Georgia, serif" 
        fontSize="21" 
        fontWeight="bold" 
        letterSpacing="4.5"
      >
        AHILIN TORRES
      </text>

      {/* Thin purple framing lines & ASESORÍA CONTABLE */}
      <line x1="56" y1="239" x2="88" y2="239" stroke="#9d73b0" strokeWidth="1.8" />
      
      <text 
        x="150" 
        y="243" 
        textAnchor="middle" 
        fill="#4d4d4d" 
        fontFamily="sans-serif" 
        fontSize="11.5" 
        fontWeight="600" 
        letterSpacing="3.5"
      >
        ASESORÍA CONTABLE
      </text>
      
      <line x1="212" y1="239" x2="244" y2="239" stroke="#9d73b0" strokeWidth="1.8" />
    </svg>
  );
};
