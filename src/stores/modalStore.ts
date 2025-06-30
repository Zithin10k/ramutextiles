import { create } from 'zustand';

interface ModalState {
  isAuthOpen: boolean;
  isCartOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  openCart: () => void;
  closeCart: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isAuthOpen: false,
  isCartOpen: false,
  
  openAuth: () => set({ isAuthOpen: true }),
  closeAuth: () => set({ isAuthOpen: false }),
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
}));