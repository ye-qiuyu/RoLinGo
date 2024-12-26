import { create } from 'zustand';

interface ImageStore {
  imageData: string;
  setImageData: (data: string) => void;
  clearImageData: () => void;
}

const useImageStore = create<ImageStore>((set) => ({
  imageData: '',
  setImageData: (data: string) => {
    console.log('Setting image data in store');
    set({ imageData: data });
    console.log('Image data set successfully');
  },
  clearImageData: () => {
    console.log('Clearing image data from store');
    set({ imageData: '' });
    console.log('Image data cleared successfully');
  },
}));

export default useImageStore; 