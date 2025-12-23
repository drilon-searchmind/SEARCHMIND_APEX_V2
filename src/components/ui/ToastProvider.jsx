import { Toaster, toast } from 'react-hot-toast';
import React from 'react';


export function showToast({ message, type, position }) {
  const opts = position ? { position } : undefined;
  if (type === 'success') {
    toast.success(message, opts);
  } else if (type === 'error') {
    toast.error(message, opts);
  } else {
    toast(message, opts);
  }
}


export default function ToastProvider() {
  // Do not set position here, allow per-toast position
  return <Toaster toastOptions={{ duration: 4000 }} />;
}
