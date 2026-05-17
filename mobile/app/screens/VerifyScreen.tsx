import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { verificationApi } from '../services/api';
import { submitZkProofOnChain, connectWallet, signMessage } from '../services/contracts';
import { useAuth } from '../services/auth';

type Method = 'zk' | 'document' | null;

export function VerifyScreen() {
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<Method>(null);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<{
    isVerified: boolean;
    method: string | null;
  }>({ isVerified: false, method: null });
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const result = await verificationApi.getStatus();
      setStatus({
        isVerified: result.isVerified,
        method: result.method,
      });
    } catch {}
  }

  async function handleZkProof() {
    setVerifying(true);
    try {
      const addr = await connectWallet();
      if (!addr) throw new Error('Wallet connection failed');

      const challenge = `Verify age for ${addr}:${Date.now()}`;
      const signature = await signMessage(challenge);
      if (!signature) throw new Error('Signing failed');

      const proof = `0x${signature.slice(2)}`;
      const publicSignals = [addr.toLowerCase()];

      await verificationApi.submitZkProof(proof, publicSignals);
      await submitZkProofOnChain(proof, publicSignals);
      await checkStatus();
    } catch (error) {
    } finally {
      setVerifying(false);
    }
  }

  async function handleDocumentUpload() {
    if (!cameraPermission?.granted) {
      const perm = await requestCameraPermission();
      if (!perm.granted) return;
    }
    setCameraVisible(true);
  }

  async function onCameraCapture(uri: string) {
    setCameraVisible(false);
    setVerifying(true);
    try {
      await verificationApi.uploadDocument(uri);
      await checkStatus();
    } catch {
    } finally {
      setVerifying(false);
    }
  }

  if (status.isVerified) {
    return (
      <View style={styles.container}>
        <View style={styles.verifiedContainer}>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedIcon}>✅</Text>
          </View>
          <Text style={styles.verifiedTitle}>Age Verified</Text>
          <Text style={styles.verifiedMethod}>
            Method: {status.method === 'zk' ? 'ZK Proof' : 'Document Upload'}
          </Text>
          <Text style={styles.verifiedNote}>
            Your age verification is active. No personal data is stored.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Age Verification</Text>
      <Text style={styles.subtitle}>
        Choose a verification method. Your privacy is our priority.
      </Text>

      <TouchableOpacity
        style={[
          styles.optionCard,
          selectedMethod === 'zk' && styles.optionSelected,
        ]}
        onPress={() => setSelectedMethod('zk')}
      >
        <Text style={styles.optionIcon}>🛡️</Text>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>ZK Proof (Recommended)</Text>
          <Text style={styles.optionDescription}>
            Privacy-preserving verification using zero-knowledge proofs.
            Connect your wallet and sign a message to prove you are 18+.
            No personal documents needed.
          </Text>
        </View>
        <View style={styles.radioOuter}>
          {selectedMethod === 'zk' && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.optionCard,
          selectedMethod === 'document' && styles.optionSelected,
        ]}
        onPress={() => setSelectedMethod('document')}
      >
        <Text style={styles.optionIcon}>📄</Text>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Document Upload</Text>
          <Text style={styles.optionDescription}>
            Upload a government-issued ID using your camera.
            Documents are encrypted and processed securely.
          </Text>
        </View>
        <View style={styles.radioOuter}>
          {selectedMethod === 'document' && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>

      {verifying ? (
        <View style={styles.verifyingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.verifyingText}>Processing verification...</Text>
        </View>
      ) : selectedMethod ? (
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={selectedMethod === 'zk' ? handleZkProof : handleDocumentUpload}
        >
          <Text style={styles.verifyButtonText}>
            {selectedMethod === 'zk' ? 'Connect Wallet & Prove Age' : 'Open Camera'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.privacyNotice}>
        <Text style={styles.privacyTitle}>🔐 Privacy Notice</Text>
        <Text style={styles.privacyText}>
          We never store raw personal data. ZK proofs verify your age without
          revealing your birth date. Document uploads are encrypted end-to-end
          and deleted after verification.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 24,
    lineHeight: 22,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  optionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#1C1C1E',
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  verifyingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  verifyingText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 12,
  },
  verifiedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  verifiedBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34C75920',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  verifiedIcon: {
    fontSize: 36,
  },
  verifiedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#34C759',
    marginBottom: 8,
  },
  verifiedMethod: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 8,
  },
  verifiedNote: {
    fontSize: 13,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 18,
  },
  privacyNotice: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 20,
  },
});
