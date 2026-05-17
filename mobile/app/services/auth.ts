import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, UserProfile } from './api';
import { connectWallet as connectWeb3Wallet, signMessage } from './contracts';

const TOKEN_KEY = '@auth_token';
const PROFILE_KEY = '@user_profile';

export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function removeStoredToken(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, PROFILE_KEY]);
  } catch {}
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  walletAddress: string | null;
}

interface AuthContextType extends AuthState {
  login: (walletAddress?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Pick<UserProfile, 'displayName' | 'email'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

async function authenticateWithBackend(walletAddress: string, signature: string): Promise<string> {
  const response = await apiClient.post<{ accessToken: string }>('/auth/wallet-login', {
    walletAddress,
    signature,
  });
  return response.accessToken;
}

async function requestChallenge(walletAddress: string): Promise<string> {
  const response = await apiClient.post<{ message: string }>('/auth/challenge', {
    walletAddress,
  });
  return response.message;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
    walletAddress: null,
  });

  const restoreSession = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        const profileStr = await AsyncStorage.getItem(PROFILE_KEY);
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          setState({
            user: profile,
            token,
            isLoading: false,
            isAuthenticated: true,
            walletAddress: profile.walletAddress,
          });
          return;
        }
      }
    } catch {}
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (walletAddress?: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const addr = walletAddress || (await connectWeb3Wallet());
      if (!addr) throw new Error('Failed to connect wallet');

      const challenge = await requestChallenge(addr);
      const signature = await signMessage(challenge);
      if (!signature) throw new Error('Failed to sign message');

      const token = await authenticateWithBackend(addr, signature);
      await AsyncStorage.setItem(TOKEN_KEY, token);

      const profileResponse = await apiClient.get<UserProfile>('/profile');
      const profile = profileResponse;
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

      setState({
        user: profile,
        token,
        isLoading: false,
        isAuthenticated: true,
        walletAddress: addr,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await removeStoredToken();
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      walletAddress: null,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await apiClient.get<UserProfile>('/profile');
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setState((prev) => ({ ...prev, user: profile, walletAddress: profile.walletAddress }));
    } catch {}
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<Pick<UserProfile, 'displayName' | 'email'>>) => {
      const updated = await apiClient.put<UserProfile>('/profile', data);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      setState((prev) => ({ ...prev, user: updated }));
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
