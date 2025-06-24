"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./Card";
import Button from "./Button";
import Input from "./Input";

export default function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName = "Profil",
}) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const CONFIRM_TEXT = "LÖSCHEN";
  const isConfirmValid = confirmText === CONFIRM_TEXT;

  const handleConfirm = async () => {
    if (!isConfirmValid) return;

    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            {itemName} unwiderruflich löschen
          </CardTitle>
          <CardDescription>
            Diese Aktion kann nicht rückgängig gemacht werden!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-muted/50 border rounded-lg p-4">
            <p className="text-sm font-medium mb-2">
              Folgende Daten werden unwiderruflich gelöscht:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Dein komplettes Benutzerprofil</li>
              <li>• Alle deine Spielergebnisse</li>
              <li>• Deine gesamte Spielhistorie</li>
              <li>• Alle Statistiken und Achievements</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmText" className="block text-sm font-medium">
              Gib <span className="font-bold">"{CONFIRM_TEXT}"</span> ein um zu
              bestätigen:
            </label>
            <Input
              id="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder={CONFIRM_TEXT}
              disabled={isDeleting}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-4">
          <Button
            onClick={handleConfirm}
            className="w-full bg-red-600 hover:bg-red-700 hover:text-black text-white transition-colors"
            disabled={!isConfirmValid || isDeleting}
          >
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Lösche...
              </div>
            ) : (
              "Unwiderruflich löschen"
            )}
          </Button>
          <Button
            onClick={handleClose}
            variant="secondary"
            className="w-full"
            disabled={isDeleting}
          >
            Abbrechen
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
