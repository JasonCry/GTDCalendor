/**
 * Tauri-native storage: when running inside Tauri, use Rust backend for file I/O.
 * Otherwise (browser) the app uses localStorage + File System Access API / sync API.
 */

import { invoke } from '@tauri-apps/api/core';

let _isTauri: boolean | null = null;

export function isTauri(): boolean {
  if (_isTauri === null) {
    _isTauri = typeof window !== 'undefined' && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
  }
  return _isTauri;
}

/** Read markdown from default store (Rust). */
export async function tauriReadMarkdown(): Promise<string> {
  return invoke<string>('read_markdown');
}

/** Write markdown to default store (Rust). */
export async function tauriWriteMarkdown(content: string): Promise<void> {
  return invoke('write_markdown', { content });
}

/** Get default store path or null. */
export async function tauriGetDefaultStorePath(): Promise<string | null> {
  const path = await invoke<string | null>('get_default_store_path');
  return path ?? null;
}

/** Set default store path (e.g. after user picks a file). */
export async function tauriSetDefaultStorePath(path: string | null): Promise<void> {
  return invoke('set_default_store_path', { path });
}

/** Read file content at path (for Open). */
export async function tauriReadFileAtPath(path: string): Promise<string> {
  return invoke<string>('read_file_at_path', { path });
}

/** Write content to path (for Save As). */
export async function tauriWriteFileAtPath(path: string, content: string): Promise<void> {
  return invoke('write_file_at_path', { path, content });
}

/** Open file dialog; returns selected path or null. Uses Tauri dialog plugin from frontend. */
export async function tauriOpenFileDialog(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (selected === null || Array.isArray(selected)) return null;
  return selected;
}

/** Save file dialog; returns chosen path or null. */
export async function tauriSaveFileDialog(): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const selected = await save({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  return selected ?? null;
}
