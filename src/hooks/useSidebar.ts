import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  isOpen: boolean
  toggle: () => void
  open:   () => void
  close:  () => void
}

export const useSidebar = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      open:   () => set({ isOpen: true }),
      close:  () => set({ isOpen: false }),
    }),
    { name: 'burbuja-sidebar' }
  )
)
