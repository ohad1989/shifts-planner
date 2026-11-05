import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes a text file to the cache and opens the share sheet (save to Files, email, WhatsApp…). */
export async function saveTextFile(filename: string, text: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

export async function copyText(text: string): Promise<boolean> {
  return Clipboard.setStringAsync(text);
}

/** Lets the user pick a file and returns its text, or null when cancelled. */
export async function pickTextFile(): Promise<string | null> {
  const DocumentPicker = await import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  return new File(res.assets[0].uri).text();
}
