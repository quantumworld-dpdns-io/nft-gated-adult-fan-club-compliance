import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

interface AgeGateModalProps {
  visible: boolean;
  onClose: () => void;
  onVerifyAge: () => void;
  contentTitle?: string;
}

export function AgeGateModal({
  visible,
  onClose,
  onVerifyAge,
  contentTitle,
}: AgeGateModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modal}>
              <View style={styles.lockIcon}>
                <Text style={styles.lockSymbol}>🔒</Text>
              </View>
              <Text style={styles.title}>Age Verification Required</Text>
              <Text style={styles.description}>
                {contentTitle
                  ? `You must be 18+ to access "${contentTitle}".`
                  : 'You must be 18+ to access this content.'}
              </Text>
              <Text style={styles.privacyNote}>
                Your privacy is protected. We use zero-knowledge proofs to verify
                your age without revealing personal information.
              </Text>
              <TouchableOpacity style={styles.verifyButton} onPress={onVerifyAge}>
                <Text style={styles.verifyButtonText}>Verify Age</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  lockIcon: {
    marginBottom: 16,
  },
  lockSymbol: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#AEAEB2',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  privacyNote: {
    fontSize: 12,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '600',
  },
});
