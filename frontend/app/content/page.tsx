"use client";

import { useState, useEffect, useCallback } from "react";
import { useWeb3ModalAccount } from "@web3modal/wagmi/react";
import { Lock, Unlock, Play, Image as ImageIcon, AlertTriangle, Loader2 } from "lucide-react";
import { AgeGate } from "@/components/AgeGate";
import { getContentItems, type ContentItem } from "@/lib/api";
import { useCanAccess } from "@/lib/contracts";

function ContentCard({
  item,
  isConnected,
  onAccess,
}: {
  item: ContentItem;
  isConnected: boolean;
  onAccess: (id: number) => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="glass-card overflow-hidden group hover:border-primary-500/30 transition-all duration-300">
      <div className="relative aspect-video bg-surface-900 overflow-hidden">
        {item.thumbnail_url && !imgError ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-surface-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-transparent to-transparent" />

        {item.is_locked && (
          <div className="absolute top-3 right-3 p-2 rounded-lg bg-red-500/20 border border-red-500/30">
            <Lock className="w-4 h-4 text-red-400" />
          </div>
        )}

        <div className="absolute bottom-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-900/80 text-surface-300 border border-surface-700">
            Tier {item.required_tier}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-surface-200 line-clamp-1">{item.title}</h3>
        <p className="text-sm text-surface-500 line-clamp-2">{item.description}</p>

        <button
          onClick={() => onAccess(item.id)}
          disabled={!isConnected}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            item.is_locked
              ? "bg-primary-600/10 border border-primary-500/20 text-primary-400 hover:bg-primary-600/20 disabled:opacity-50"
              : "bg-green-600/10 border border-green-500/20 text-green-400 hover:bg-green-600/20"
          }`}
        >
          {item.is_locked ? (
            <>
              <Lock className="w-4 h-4" />
              Unlock with Membership
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Access Content
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const { address, isConnected } = useWeb3ModalAccount();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<number | null>(null);
  const [accessingId, setAccessingId] = useState<number | null>(null);

  const { refetch: checkAccess } = useCanAccess(address, selectedContentId !== null ? BigInt(selectedContentId) : undefined);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getContentItems();
      setItems(data);
    } catch {
      setError("Failed to load content. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccess = useCallback(async (contentId: number) => {
    if (!isConnected) return;
    setSelectedContentId(contentId);
    setAccessingId(contentId);

    try {
      setShowAgeGate(true);
      const { data: hasAccess } = await checkAccess();
      if (hasAccess) {
        setShowAgeGate(false);
      }
    } catch {
      console.error("Access check failed");
    } finally {
      setAccessingId(null);
      setSelectedContentId(null);
    }
  }, [isConnected, checkAccess]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
          <span className="text-surface-400">Loading content...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-200 mb-2">Error Loading Content</h2>
          <p className="text-surface-400 mb-6">{error}</p>
          <button onClick={loadContent} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AgeGate isOpen={showAgeGate} onClose={() => setShowAgeGate(false)} />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-surface-100">Content Gallery</h1>
            <p className="mt-2 text-surface-400">
              Browse exclusive gated content. Verify your age and hold a membership to unlock.
            </p>
          </div>
          {!isConnected && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300">Connect to unlock</span>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 text-surface-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-surface-300 mb-2">No Content Available</h3>
            <p className="text-surface-500">Content will appear here once published by the platform.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                isConnected={isConnected}
                onAccess={handleAccess}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
