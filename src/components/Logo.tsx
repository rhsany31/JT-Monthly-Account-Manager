import React from "react";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  circular?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = "",
  showTagline = true,
  size = "md",
  circular = false
}) => {
  // Determine sizing
  const dimensions = {
    sm: { width: 140, height: 140 },
    md: { width: 280, height: 280 },
    lg: { width: 400, height: 400 }
  }[size];

  if (circular) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto max-w-full"
        >
          {/* Light cyan/blue background circle */}
          <circle cx="200" cy="200" r="190" fill="#e3f2fd" />
          
          {/* Outer Ring Border */}
          <circle cx="200" cy="200" r="190" stroke="#ffffff" strokeWidth="4" />

          {/* Monogram Symbol Centered inside circle */}
          <g transform="translate(100, 75)">
            {/* Swoosh trail / J Curve */}
            {/* The bold red/orange sweep */}
            <path
              d="M -5 85 C -25 55, 30 10, 110 5 C 40 18, 10 50, 15 88 C 20 115, 65 110, 85 105 C 50 118, 5 115, -5 85 Z"
              fill="url(#redGradient)"
            />

            {/* The purple flying airplane trail */}
            <path
              d="M 28 80 C 15 60, 40 25, 150 12 C 90 22, 50 48, 55 80"
              stroke="url(#purpleGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />

            {/* The Purple T Letter */}
            <path
              d="M 75 42 L 145 42 L 145 57 L 118 57 L 118 112 L 98 112 L 98 57 L 75 57 Z"
              fill="url(#purpleGradient)"
            />

            {/* T's right accent bar */}
            <path
              d="M 152 42 L 175 42 C 182 42, 185 45, 182 51 L 174 57 L 152 57 Z"
              fill="#7e22ce"
            />

            {/* Flying Jet Airplane (Purple) */}
            <g transform="translate(152, 5) rotate(-22)">
              <path
                d="M 12 0 
                   L 32 8 
                   L 40 4 
                   L 44 6 
                   L 38 14 
                   L 24 14 
                   L 20 28 
                   L 26 30 
                   L 24 33 
                   L 12 29 
                   L 7 14 
                   L -3 14 
                   L -7 10 
                   L -3 8 
                   L 7 8 
                   Z"
                fill="#581c87"
                stroke="#ffffff"
                strokeWidth="1"
              />
            </g>
          </g>

          {/* BRAND TEXT GROUP */}
          <g transform="translate(200, 275)">
            {/* Brand text: JT TOURS & TRAVEL */}
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fontFamily="'Space Grotesk', 'Inter', sans-serif"
              fontWeight="900"
              fontSize="25"
              letterSpacing="1"
            >
              <tspan fill="#ea580c">JT </tspan>
              <tspan fill="#4c1d95">TOURS & TRAVEL</tspan>
            </text>

            {/* Tagline */}
            {showTagline && (
              <g transform="translate(0, 24)">
                {/* Left red wedge */}
                <path d="M -135 -4 L -110 -2 L -135 0 Z" fill="#ea580c" />
                
                {/* Tagline Text */}
                <text
                  x="0"
                  y="1"
                  textAnchor="middle"
                  fontFamily="'Space Grotesk', 'Inter', sans-serif"
                  fontWeight="700"
                  fontSize="10"
                  letterSpacing="2"
                  fill="#475569"
                >
                  YOUR COMFORT OUR PRIORITY
                </text>

                {/* Right red wedge */}
                <path d="M 135 -4 L 110 -2 L 135 0 Z" fill="#ea580c" />
              </g>
            )}
          </g>

          {/* Defs / Gradients */}
          <defs>
            <linearGradient id="redGradient" x1="0" y1="5" x2="80" y2="110" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="purpleGradient" x1="75" y1="12" x2="160" y2="112" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#581c87" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // Transparent/horizontal clean layout for header bar & navbar
  return (
    <div className={`flex items-center ${className}`}>
      <svg
        width={dimensions.width}
        height="64"
        viewBox="0 0 320 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="max-h-full"
      >
        {/* Compact Logo Symbol */}
        <g transform="translate(10, 8) scale(0.35)">
          {/* Swoosh trail / J Curve */}
          <path
            d="M -5 85 C -25 55, 30 10, 110 5 C 40 18, 10 50, 15 88 C 20 115, 65 110, 85 105 C 50 118, 5 115, -5 85 Z"
            fill="url(#redGradientTrans)"
          />

          {/* The purple flying airplane trail */}
          <path
            d="M 28 80 C 15 60, 40 25, 150 12 C 90 22, 50 48, 55 80"
            stroke="url(#purpleGradientTrans)"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />

          {/* The Purple T Letter */}
          <path
            d="M 75 42 L 145 42 L 145 57 L 118 57 L 118 112 L 98 112 L 98 57 L 75 57 Z"
            fill="url(#purpleGradientTrans)"
          />

          {/* T's right accent bar */}
          <path
            d="M 152 42 L 175 42 C 182 42, 185 45, 182 51 L 174 57 L 152 57 Z"
            fill="#7e22ce"
          />

          {/* Flying Jet Airplane */}
          <g transform="translate(152, 5) rotate(-22)">
            <path
              d="M 12 0 
                 L 32 8 
                 L 40 4 
                 L 44 6 
                 L 38 14 
                 L 24 14 
                 L 20 28 
                 L 26 30 
                 L 24 33 
                 L 12 29 
                 L 7 14 
                 L -3 14 
                 L -7 10 
                 L -3 8 
                 L 7 8 
                 Z"
              fill="#581c87"
              stroke="#ffffff"
              strokeWidth="1"
            />
          </g>
        </g>

        {/* Text next to Symbol */}
        <g transform="translate(80, 28)">
          <text
            fontFamily="'Space Grotesk', 'Inter', sans-serif"
            fontWeight="900"
            fontSize="18"
            letterSpacing="0.5"
          >
            <tspan fill="#ea580c">JT </tspan>
            <tspan fill="#93c5fd">TOURS & TRAVEL</tspan>
          </text>
          
          {showTagline && (
            <text
              x="0"
              y="14"
              fontFamily="'Space Grotesk', 'Inter', sans-serif"
              fontWeight="700"
              fontSize="7.5"
              letterSpacing="1.2"
              fill="#94a3b8"
            >
              YOUR COMFORT OUR PRIORITY
            </text>
          )}
        </g>

        <defs>
          <linearGradient id="redGradientTrans" x1="0" y1="5" x2="80" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="purpleGradientTrans" x1="75" y1="12" x2="160" y2="112" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
