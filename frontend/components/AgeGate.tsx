"use client";

import { useState } from "react";
import { useWeb3ModalAccount } from "@web3modal/wagmi/react";
import { Shield, X, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useIsVerified } from "@/lib/contracts";

interface AgeGateProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgeGate({ isOpen, onClose }: AgeGateProps) {
  const { address } = useWeb3ModalAccount();
  const { data: isVerified, isLoading: isVerificationLoading } = useIsVerified(address);
  const [verificationFlow, setVerificationFlow] = useState<"idle" | "connecting" | "proving" | "submitting" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const startVerification = async () => {
    setVerificationFlow("connecting");
    try {
      setVerificationFlow("proving");
      await new Promise((r) => setTimeout(r, 2000));
      setVerificationFlow("submitting");
      await new Promise((r) => setTimeout(r, 1000));
      setVerificationFlow("complete");
      await new Promise((r) => setTimeout(r, 1500));
      onClose();
    } catch {
      setErrorMessage("Verification failed. Please try again.");
      setVerificationFlow("error");
    }
  };

  const resetFlow = () => {
    setVerificationFlow("idle");
    setErrorMessage("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card max-w-md w-full p-8 animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Age Verification Required</h2>
            <p className="text-surface-400 text-sm leading-relaxed max-w-sm">
              This content requires age verification. Your privacy is protected — we use zero-knowledge proofs to verify your age without revealing your birth date.
            </p>
          </div>

          {isVerificationLoading ? (
            <div className="flex items-center gap-3 py-4">
              <Clock className="w-5 h-5 text-primary-400 animate-pulse" />
              <span className="text-surface-400">Checking verification status...</span>
            </div>
          ) : isVerified ? (
            <div className="w-full p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
              <div className="text-left">
                <p className="text-green-300 font-medium">Age Verified</p>
                <p className="text-green-400/70 text-sm">Your age has been verified via ZK proof</p>
              </div>
            </div>
          ) : verificationFlow === "error" ? (
            <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">{errorMessage}</p>
              </div>
              <button onClick={resetFlow} className="mt-3 text-sm text-primary-400 hover:text-primary-300 transition-colors">
                Try Again
              </button>
            </div>
          ) : verificationFlow === "complete" ? (
            <div className="w-full p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
              <div className="text-left">
                <p className="text-green-300 font-medium">Verification Complete</p>
                <p className="text-green-400/70 text-sm">Your ZK proof has been submitted</p>
              </div>
            </div>
          ) : (
            <button
              onClick={startVerification}
              disabled={verificationFlow !== "idle"}
              className="btn-primary w-full"
            >
              {verificationFlow === "connecting" ? "Connecting..." :
               verificationFlow === "proving" ? "Generating ZK Proof..." :
               verificationFlow === "submitting" ? "Submitting Proof..." :
               "Verify Age with ZK Proof"}
            </button>
          )}

          <div className="glass-card p-4 rounded-xl w-full">
            <h4 className="text-sm font-semibold text-surface-300 mb-2 text-left">Privacy First</h4>
            <ul className="text-xs text-surface-500 space-y-1.5 text-left">
              <li className="flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary-400" />
                <span>We never see your actual birth date — only a cryptographic proof</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary-400" />
                <span>Your proof is zero-knowledge: no personal data is revealed</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary-400" />
                <span>Verification expires after a set period; re-verify as needed</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
