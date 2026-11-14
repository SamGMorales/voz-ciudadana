export function fechaHora(ms) {
  return new Date(ms).toLocaleString('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function porcentaje(n) {
  return Math.round((n || 0) * 100) + '%';
}

// reduce la foto en el navegador antes de enviarla
export function comprimirImagen(archivo, maxLado = 1280, calidad = 0.75) {
  return new Promise((resolve, reject) => {
    if (!archivo.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen'));
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = lector.result;
    };
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });
}

export const nombreSentimiento = {
  positive: 'Positivo', neutral: 'Neutral', negative: 'Negativo', mixed: 'Mixto',
  positivo: 'Positivo', negativo: 'Negativo', mixto: 'Mixto'
};

export function claseSentimiento(s) {
  if (!s) return 'sin';
  if (s.startsWith('pos')) return 'pos';
  if (s.startsWith('neg')) return 'neg';
  if (s.startsWith('mix')) return 'mix';
  return 'neu';
}
