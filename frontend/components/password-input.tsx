"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface PasswordInputProps {
  name: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  showRequirements?: boolean;
}

export function PasswordInput({
  name,
  placeholder = "Your password",
  required = false,
  minLength = 6,
  showRequirements = true,
}: PasswordInputProps) {
  const [password, setPassword] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const validatePassword = (value: string) => {
    if (!value) {
      setIsValid(false);
      setErrorMessage("Password is required");
      return false;
    }

    if (value.length < minLength) {
      setIsValid(false);
      setErrorMessage(`Password must be at least ${minLength} characters long`);
      return false;
    }

    // Check for lowercase letters
    if (!/[a-z]/.test(value)) {
      setIsValid(false);
      setErrorMessage("Password must contain at least one lowercase letter");
      return false;
    }

    // Check for uppercase letters
    if (!/[A-Z]/.test(value)) {
      setIsValid(false);
      setErrorMessage("Password must contain at least one uppercase letter");
      return false;
    }

    // Check for numbers
    if (!/[0-9]/.test(value)) {
      setIsValid(false);
      setErrorMessage("Password must contain at least one number");
      return false;
    }

    // Check for special characters
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(value)) {
      setIsValid(false);
      setErrorMessage("Password must contain at least one special character");
      return false;
    }

    setIsValid(true);
    setErrorMessage("");
    return true;
  };

  useEffect(() => {
    if (password) {
      validatePassword(password);
    }
  }, [password]);

  return (
    <div className="space-y-1">
      <Input
        type="password"
        name={name}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={!isValid ? "border-destructive" : ""}
      />
      {!isValid && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
      {password && isValid && showRequirements && (
        <p className="text-xs text-green-600">Password meets all requirements</p>
      )}
      {showRequirements && (
        <p className="text-xs text-muted-foreground mt-1">
          Password should contain at least one character of each: lowercase letter, uppercase letter, number, and special character.
        </p>
      )}
    </div>
  );
}
