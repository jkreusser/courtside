"use client";

import { useState } from "react";
import { generateDefaultAvatar } from "@/lib/supabase-client";

export default function Avatar({
  src,
  name,
  size = "md",
  className = "",
  showName = false,
  fallbackColor = "#0d2a18",
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Größen-Klassen
  const sizeClasses = {
    xs: "w-6 h-6 text-xs",
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
    xl: "w-16 h-16 text-xl",
    "2xl": "w-20 h-20 text-2xl",
    "3xl": "w-24 h-24 text-3xl",
  };

  // Initialen generieren
  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2);
  };

  // Einheitliche graue Farbe für alle Standard-Avatare
  const getColorFromName = (name) => {
    // Immer die gleiche graue Farbe verwenden für konsistentes Design
    return "#6b7280"; // Grau (zinc-500)
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const initials = getInitials(name);
  const backgroundColor = getColorFromName(name);
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Avatar Circle */}
      <div
        className={`
                    relative rounded-full overflow-hidden flex-shrink-0
                    ${sizeClass} 
                    ${
                      !src || imageError
                        ? "flex items-center justify-center text-white font-semibold"
                        : ""
                    }
                `}
        style={{
          backgroundColor: !src || imageError ? backgroundColor : "transparent",
        }}
      >
        {/* Profilbild */}
        {src && !imageError && (
          <>
            <img
              src={src}
              alt={name || "Avatar"}
              className={`
                                w-full h-full object-cover transition-opacity duration-200
                                ${imageLoaded ? "opacity-100" : "opacity-0"}
                            `}
              onError={handleImageError}
              onLoad={handleImageLoad}
            />

            {/* Loading Placeholder */}
            {!imageLoaded && (
              <div
                className="absolute inset-0 flex items-center justify-center text-white font-semibold animate-pulse"
                style={{ backgroundColor }}
              >
                {initials}
              </div>
            )}
          </>
        )}

        {/* Fallback: Initialen */}
        {(!src || imageError) && (
          <span className="select-none">{initials}</span>
        )}
      </div>

      {/* Name (optional) */}
      {showName && name && (
        <span className="text-sm font-medium truncate">{name}</span>
      )}
    </div>
  );
}

// Spezielle Varianten für häufige Anwendungsfälle
export function AvatarWithName({ src, name, size = "md", className = "" }) {
  return (
    <Avatar
      src={src}
      name={name}
      size={size}
      showName={true}
      className={className}
    />
  );
}

export function AvatarGroup({ avatars, max = 3, size = "md", className = "" }) {
  const displayAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  return (
    <div className={`flex -space-x-2 ${className}`}>
      {displayAvatars.map((avatar, index) => (
        <div key={avatar.id || index} className="relative">
          <Avatar
            src={avatar.src}
            name={avatar.name}
            size={size}
            className="border-2 border-zinc-800"
          />
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={`
                        ${sizeClasses[size] || sizeClasses.md}
                        rounded-full bg-zinc-700 border-2 border-zinc-800
                        flex items-center justify-center text-white text-xs font-medium
                    `}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

// Größen-Klassen für AvatarGroup
const sizeClasses = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
  "2xl": "w-20 h-20",
  "3xl": "w-24 h-24",
};
