/** Nabídne soubor ke stažení. Vše vzniká v prohlížeči, nic se neodesílá na server. */
export function download(bytes: Uint8Array | Blob, name: string, type = 'application/octet-stream') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes.slice().buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Prohlížeč si soubor převezme při kliknutí; adresu stačí chvíli držet.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
