const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export function validarImagem(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Formato não suportado. Use JPG, PNG, GIF ou WebP.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 2MB.`;
  }
  return null;
}

export function lerImagemComoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const erro = validarImagem(file);
    if (erro) { reject(new Error(erro)); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'));
    reader.readAsDataURL(file);
  });
}
