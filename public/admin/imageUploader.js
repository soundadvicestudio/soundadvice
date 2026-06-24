// Read at call time so the secret is available after loadAdminSecret() resolves
function getAdminSecret() { return window.__ADMIN_SECRET__; }

/**
 * Full image upload flow:
 * 1. Get signed URL from our API
 * 2. Upload file directly to Supabase Storage
 * 3. Return the public URL
 */
export async function uploadImageToStorage(file, onProgress, storagePath) {
  // Step 1: Get signed upload URL
  const uploadMeta = { filename: file.name, contentType: file.type };
  if (storagePath) uploadMeta.storagePath = storagePath;
  const metaRes = await fetch('/api/admin/getUploadUrl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': getAdminSecret(),
    },
    body: JSON.stringify(uploadMeta),
  });

  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(err.error || 'Failed to get upload URL');
  }

  const { signedURL, publicUrl, token } = await metaRes.json();

  // Step 2: Upload directly to Supabase Storage
  onProgress?.('Uploading...');
  const uploadRes = await fetch(signedURL, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error('Upload to storage failed');
  }

  onProgress?.('Done');
  return publicUrl;
}

/**
 * Delete an image from storage by its full public URL.
 * Extracts the storagePath from the URL automatically.
 */
export async function deleteImageFromStorage(publicUrl) {
  // Extract storage path from public URL
  // URL format: https://xxx.supabase.co/storage/v1/object/public/studio-images/events/xxx.jpg
  const match = publicUrl.match(/\/studio-images\/(.+)$/);
  if (!match) return; // Not a storage URL, skip
  const storagePath = match[1];

  await fetch('/api/admin/deleteImage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': getAdminSecret(),
    },
    body: JSON.stringify({ storagePath }),
  });
}

/**
 * Canvas-based image crop and resize tool.
 * Opens a crop UI overlay, returns a Promise that resolves
 * with a cropped File object ready for uploadImageToStorage().
 *
 * Usage:
 *   const croppedFile = await openCropTool(originalFile, { aspectRatio: null });
 *   const publicUrl = await uploadImageToStorage(croppedFile, onProgress);
 */
export function openCropTool(file, options = {}) {
  return new Promise((resolve, reject) => {
    const { aspectRatio = null } = options; // null = free crop

    // Create the overlay
    const overlay = document.createElement('div');
    overlay.id = 'crop-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 20px;
      font-family: 'DM Sans', sans-serif;
    `;

    const title = document.createElement('p');
    title.textContent = 'Crop & Resize Image';
    title.style.cssText = `color: rgb(252,151,121); font-size: 20px; font-weight: 600; margin: 0;`;

    const instruction = document.createElement('p');
    instruction.textContent = 'Drag to reposition. Handles to resize crop area.';
    instruction.style.cssText = `color: rgba(255,255,255,0.6); font-size: 13px; margin: 0;`;

    // Canvas for preview
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = `position: relative; user-select: none;`;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `display: block; max-width: 700px; max-height: 500px;`;
    canvasWrap.appendChild(canvas);

    // Crop handle overlay (semi-transparent border box)
    const cropHandle = document.createElement('div');
    cropHandle.style.cssText = `
      position: absolute; border: 2px solid rgb(74,138,147);
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);
      cursor: move; box-sizing: border-box;
    `;
    canvasWrap.appendChild(cropHandle);

    // Resize handle (bottom-right corner)
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
      position: absolute; bottom: -6px; right: -6px;
      width: 14px; height: 14px;
      background: rgb(74,138,147); cursor: se-resize; border-radius: 2px;
    `;
    cropHandle.appendChild(resizeHandle);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `display: flex; gap: 12px;`;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      background: transparent; border: 1px solid rgba(255,255,255,0.3);
      color: white; padding: 10px 28px; font-size: 14px;
      font-family: 'DM Sans', sans-serif; cursor: pointer;
    `;

    const cropBtn = document.createElement('button');
    cropBtn.textContent = 'Apply Crop & Upload';
    cropBtn.style.cssText = `
      background: rgb(74,138,147); border: none;
      color: white; padding: 10px 28px; font-size: 14px; font-weight: 600;
      font-family: 'DM Sans', sans-serif; cursor: pointer;
    `;

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(cropBtn);
    overlay.appendChild(title);
    overlay.appendChild(instruction);
    overlay.appendChild(canvasWrap);
    overlay.appendChild(btnRow);
    document.body.appendChild(overlay);

    // Load image onto canvas
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      // Scale to fit display
      const maxW = 700, maxH = 500;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Initial crop box = full image
      let cropX = 0, cropY = 0;
      let cropW = canvas.width, cropH = canvas.height;

      const updateCropHandle = () => {
        cropHandle.style.left = cropX + 'px';
        cropHandle.style.top = cropY + 'px';
        cropHandle.style.width = cropW + 'px';
        cropHandle.style.height = cropH + 'px';
      };
      updateCropHandle();

      // Drag to move crop box
      let dragging = false, dragStartX = 0, dragStartY = 0, dragStartCropX = 0, dragStartCropY = 0;
      cropHandle.addEventListener('mousedown', (e) => {
        if (e.target === resizeHandle) return;
        dragging = true;
        dragStartX = e.clientX; dragStartY = e.clientY;
        dragStartCropX = cropX; dragStartCropY = cropY;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        cropX = Math.max(0, Math.min(canvas.width - cropW, dragStartCropX + (e.clientX - dragStartX)));
        cropY = Math.max(0, Math.min(canvas.height - cropH, dragStartCropY + (e.clientY - dragStartY)));
        updateCropHandle();
      });
      document.addEventListener('mouseup', () => { dragging = false; });

      // Drag resize handle
      let resizing = false, resizeStartX = 0, resizeStartY = 0, resizeStartW = 0, resizeStartH = 0;
      resizeHandle.addEventListener('mousedown', (e) => {
        resizing = true;
        resizeStartX = e.clientX; resizeStartY = e.clientY;
        resizeStartW = cropW; resizeStartH = cropH;
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        const newW = Math.max(50, Math.min(canvas.width - cropX, resizeStartW + (e.clientX - resizeStartX)));
        let newH = aspectRatio ? newW / aspectRatio : Math.max(50, Math.min(canvas.height - cropY, resizeStartH + (e.clientY - resizeStartY)));
        cropW = newW; cropH = newH;
        updateCropHandle();
      });
      document.addEventListener('mouseup', () => { resizing = false; });

      // Apply crop
      cropBtn.addEventListener('click', () => {
        // Map display crop coords back to original image coords
        const scaleBack = 1 / scale;
        const srcX = Math.round(cropX * scaleBack);
        const srcY = Math.round(cropY * scaleBack);
        const srcW = Math.round(cropW * scaleBack);
        const srcH = Math.round(cropH * scaleBack);

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = srcW;
        outputCanvas.height = srcH;
        const outCtx = outputCanvas.getContext('2d');
        outCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

        outputCanvas.toBlob((blob) => {
          const croppedFile = new File([blob], file.name, { type: 'image/jpeg' });
          URL.revokeObjectURL(objectUrl);
          document.body.removeChild(overlay);
          resolve(croppedFile);
        }, 'image/jpeg', 0.92);
      });

      cancelBtn.addEventListener('click', () => {
        URL.revokeObjectURL(objectUrl);
        document.body.removeChild(overlay);
        reject(new Error('Crop cancelled'));
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      document.body.removeChild(overlay);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}
