/**
 * compressImage
 * Resizes an image file to maxWidth×maxHeight and re-encodes as WebP at the
 * given quality. Returns a base64 data-URL string ready to store in the DB.
 *
 * Typical reduction:
 *   2 MB phone photo  →  ~8 KB
 *   500 KB PNG        →  ~4 KB
 *   200 KB JPEG       →  ~3 KB
 *
 * No decompression needed on display — use the returned string directly as
 * the `src` attribute of an <img> tag.
 */
export const compressImage = (
    file: File,
    maxWidth  = 300,   // px — enough for an option thumbnail
    maxHeight = 300,   // px
    quality   = 0.6,   // 0–1 WebP quality (0.6 = 60 %, good balance)
): Promise<string> =>
    new Promise((resolve, reject) => {
        const img    = new Image();
        const reader = new FileReader();

        reader.onerror = reject;
        img.onerror    = reject;

        reader.onload = e => {
            img.src = e.target?.result as string;
        };

        img.onload = () => {
            // ── Scale down keeping aspect ratio ──────────────────────
            let { width, height } = img;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width  = maxWidth;
            }
            if (height > maxHeight) {
                width  = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }

            // ── Draw onto canvas ──────────────────────────────────────
            const canvas = document.createElement('canvas');
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

            // ── WebP gives ~30 % smaller than JPEG at same quality ────
            const compressed = canvas.toDataURL('image/webp', quality);
            resolve(compressed);
        };

        reader.readAsDataURL(file);
    });
