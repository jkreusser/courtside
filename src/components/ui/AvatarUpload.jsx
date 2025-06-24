"use client";

import { useState, useRef } from "react";
import {
  uploadAvatar,
  deleteAvatar,
  generateDefaultAvatar,
} from "@/lib/supabase-client";
import Button from "./Button";
import toast from "react-hot-toast";

export default function AvatarUpload({
  userId,
  currentAvatarUrl,
  onAvatarChange,
  className = "",
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl);
  const fileInputRef = useRef(null);

  // Validierung
  const validateFile = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      throw new Error("Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP");
    }

    if (file.size > maxSize) {
      throw new Error("Datei ist zu groß. Maximale Größe: 5MB");
    }

    return true;
  };

  // Datei-Upload verarbeiten
  const handleFileUpload = async (file) => {
    try {
      validateFile(file);
      setIsUploading(true);

      // Vorschau generieren
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);

      // Upload
      const result = await uploadAvatar(userId, file);

      if (result.success) {
        toast.success(result.message);
        setPreviewUrl(result.avatarUrl);
        onAvatarChange?.(result.avatarUrl);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.message || "Fehler beim Upload");
      setPreviewUrl(currentAvatarUrl); // Zurück zur ursprünglichen Vorschau
    } finally {
      setIsUploading(false);
    }
  };

  // Avatar löschen
  const handleDeleteAvatar = async () => {
    try {
      setIsDeleting(true);
      const result = await deleteAvatar(userId);

      if (result.success) {
        toast.success(result.message);
        setPreviewUrl(null);
        onAvatarChange?.(null);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error.message || "Fehler beim Löschen");
    } finally {
      setIsDeleting(false);
    }
  };

  // File Input Change
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Drag & Drop Events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Click Handler
  const handleClick = () => {
    if (!isUploading && !isDeleting) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Avatar Vorschau und Upload-Bereich */}
      <div
        className={`
                    relative group cursor-pointer rounded-full overflow-hidden
                    w-32 h-32 mx-auto border-4 border-zinc-700 hover:border-zinc-600
                    transition-all duration-200
                    ${isDragOver ? "border-primary bg-primary/10" : ""}
                    ${
                      isUploading || isDeleting
                        ? "pointer-events-none opacity-70"
                        : ""
                    }
                `}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Aktuelles Avatar oder Placeholder */}
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Profilbild"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        )}

        {/* Overlay bei Hover */}
        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          {isUploading ? (
            <div className="text-white text-center">
              <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
              <span className="text-sm">Uploading...</span>
            </div>
          ) : isDeleting ? (
            <div className="text-white text-center">
              <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
              <span className="text-sm">Lösche...</span>
            </div>
          ) : (
            <div className="text-white text-center">
              <svg
                className="w-8 h-8 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm">Foto ändern</span>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isUploading || isDeleting}
        />
      </div>

      {/* Drag & Drop Hinweis */}
      {isDragOver && (
        <div className="text-center text-primary text-sm font-medium">
          Datei hier ablegen...
        </div>
      )}

      {/* Aktions-Buttons */}
      <div className="flex gap-2 justify-center">
        <Button
          onClick={handleClick}
          disabled={isUploading || isDeleting}
          className="text-sm"
        >
          {isUploading ? "Uploading..." : "Foto auswählen"}
        </Button>

        {previewUrl && (
          <Button
            onClick={handleDeleteAvatar}
            disabled={isUploading || isDeleting}
            variant="secondary"
            className="text-sm"
          >
            {isDeleting ? "Lösche..." : "Löschen"}
          </Button>
        )}
      </div>

      {/* Hinweise */}
      <div className="text-center text-sm text-zinc-500 space-y-1">
        <p>JPG, PNG oder WebP • Max. 5MB</p>
        <p>Klicken oder Datei hierher ziehen</p>
      </div>
    </div>
  );
}
