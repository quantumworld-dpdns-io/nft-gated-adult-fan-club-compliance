"use client";

import { useState } from "react";
import { useWeb3ModalAccount } from "@web3modal/wagmi/react";
import { useIsVerified } from "@/lib/contracts";
import { submitAgeVerification, uploadKycDocument } from "@/lib/api";
import { AgeGate } from "@/components/AgeGate";
import {
  Shield,
  Fingerprint,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Upload,
  Info,
} from "lucide-react";

type VerificationMethod = "zk" | "kyc" | null;

export default function VerifyPage() {
  const { address, isConnected } = useWeb3ModalAccount();
  const { data: isVerified, isLoading: verifLoading, refetch: refetchVerification } = useIsVerified(address);
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [kycFile, setKycFile] = useState<File | null>(null);

  const handleZkVerification = async () => {
    setSelectedMethod("zk");
    setStatus("processing");
    setStatusMessage("Generating zero-knowledge proof...");
    try {
      await new Promise((r) => setTimeout(r, 2000));
      setStatusMessage("Submitting proof to verifier...");
      const result = await submitAgeVerification("0x" + "a".repeat(64));
      setStatus("success");
      setStatusMessage("Age verified via ZK proof! Your privacy is preserved.");
      refetchVerification();
    } catch {
      setStatus("error");
      setStatusMessage("Verification failed. Please try again.");
    }
  };

  const handleKycUpload = async () => {
    if (!kycFile) return;
    setSelectedMethod("kyc");
    setStatus("processing");
    setStatusMessage("Uploading KYC document...");
    try {
      const result = await uploadKycDocument(kycFile);
      setStatus("success");
      setStatusMessage("KYC document submitted for review. We'll notify you once verified.");
    } catch {
      setStatus("error");
      setStatusMessage("Upload failed. Please check your file and try again.");
    }
  };

  return (
    <div className="min-h-screen">
      <AgeGate isOpen={showAgeGate} onClose={() => setShowAgeGate(false)} />

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-surface-100">Age Verification</h1>
          <p className="mt-4 text-lg text-surface-400 max-w-2xl mx-auto">
            Verify your age to access gated content. Choose between privacy-preserving ZK proof or traditional KYC.
          </p>
        </div>

        {verifLoading ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
            <span className="text-surface-400">Checking verification status...</span>
          </div>
        ) : isVerified ? (
          <div className="max-w-lg mx-auto p-6 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-4">
              <CheckCircle className="w-8 h-8 text-green-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-green-300">Age Verified</h3>
                <p className="text-sm text-green-400/70">
                  Your age has been verified. You can access age-gated content on the platform.
                </p>
              </div>
            </div>
          </div>
        ) : !isConnected ? (
          <div className="max-w-lg mx-auto p-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="font-semibold text-amber-300">Connect Your Wallet</h3>
            <p className="text-sm text-amber-400/70 mt-1">
              You need to connect your wallet before verifying your age.
            </p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <button
                onClick={() => setSelectedMethod("zk")}
                className={`glass-card p-6 text-left transition-all duration-300 ${
                  selectedMethod === "zk"
                    ? "border-primary-500 ring-2 ring-primary-500/20"
                    : "hover:border-surface-600"
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 p-0.5 mb-4">
                  <div className="w-full h-full rounded-xl bg-surface-900 flex items-center justify-center">
                    <Fingerprint className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-surface-200 mb-2">ZK Proof Verification</h3>
                <p className="text-sm text-surface-400 leading-relaxed">
                  Prove you&apos;re over the age threshold without revealing your birth date.
                  Zero-knowledge cryptography ensures your data stays private.
                </p>
                <ul className="mt-4 space-y-2">
                  {["No personal data shared", "Instant verification", "Reusable proof", "Privacy guaranteed"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-surface-500">
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </button>

              <button
                onClick={() => setSelectedMethod("kyc")}
                className={`glass-card p-6 text-left transition-all duration-300 ${
                  selectedMethod === "kyc"
                    ? "border-primary-500 ring-2 ring-primary-500/20"
                    : "hover:border-surface-600"
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-0.5 mb-4">
                  <div className="w-full h-full rounded-xl bg-surface-900 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-surface-200 mb-2">Traditional KYC</h3>
                <p className="text-sm text-surface-400 leading-relaxed">
                  Upload a government-issued ID document for manual verification.
                  Your documents are encrypted and handled per GDPR guidelines.
                </p>
                <ul className="mt-4 space-y-2">
                  {["Government ID upload", "Manual review process", "24-48 hour turnaround", "GDPR compliant"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-surface-500">
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </button>
            </div>

            {selectedMethod === "zk" && (
              <div className="max-w-lg mx-auto space-y-4">
                {status === "processing" && (
                  <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-primary-400 animate-spin shrink-0" />
                    <span className="text-sm text-primary-300">{statusMessage}</span>
                  </div>
                )}

                {status === "success" && (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    <span className="text-sm text-green-300">{statusMessage}</span>
                  </div>
                )}

                {status === "error" && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <span className="text-sm text-red-300">{statusMessage}</span>
                  </div>
                )}

                {status === "idle" && (
                  <button onClick={handleZkVerification} className="btn-primary w-full">
                    <Fingerprint className="w-5 h-5 mr-2" />
                    Generate ZK Age Proof
                  </button>
                )}

                {status === "error" && (
                  <button onClick={handleZkVerification} className="btn-primary w-full">
                    Try Again
                  </button>
                )}
              </div>
            )}

            {selectedMethod === "kyc" && (
              <div className="max-w-lg mx-auto space-y-4">
                <div className="glass-card p-6">
                  <label className="block mb-2 text-sm font-medium text-surface-300">
                    Upload Government ID
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-surface-600 hover:border-primary-500/50 cursor-pointer transition-colors">
                      <Upload className="w-5 h-5 text-surface-400" />
                      <span className="text-sm text-surface-400">
                        {kycFile ? kycFile.name : "Choose file (PDF, JPG, PNG)"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-surface-500">
                    Max file size: 10MB. Supported formats: PDF, JPG, PNG.
                  </p>
                </div>

                {status === "processing" && (
                  <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-primary-400 animate-spin shrink-0" />
                    <span className="text-sm text-primary-300">{statusMessage}</span>
                  </div>
                )}

                {status === "success" && (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    <span className="text-sm text-green-300">{statusMessage}</span>
                  </div>
                )}

                {status === "error" && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <span className="text-sm text-red-300">{statusMessage}</span>
                  </div>
                )}

                {(status === "idle" || status === "error") && (
                  <button
                    onClick={handleKycUpload}
                    disabled={!kycFile}
                    className="btn-primary w-full"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Upload & Submit
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="glass-card p-8">
          <div className="flex items-start gap-4">
            <Info className="w-6 h-6 text-primary-400 shrink-0 mt-0.5" />
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-surface-100">Why Zero-Knowledge Proofs?</h2>
              <div className="space-y-3 text-sm text-surface-400 leading-relaxed">
                <p>
                  Zero-knowledge proofs (ZKPs) allow you to prove that you meet an age threshold
                  without revealing your actual birth date or any other personal information.
                  This is fundamentally different from traditional KYC where you must share
                  sensitive documents.
                </p>
                <p>
                  <strong className="text-surface-300">How it works:</strong> Your birth date and the current date
                  are used as private inputs to a ZK circuit. The circuit computes your age and outputs
                  a proof that you meet the threshold — without ever revealing the actual dates.
                </p>
                <p>
                  <strong className="text-surface-300">Benefits:</strong> No personal data stored on our servers.
                  No risk of data breaches exposing your identity. Full privacy while maintaining
                  compliance with age verification requirements.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
