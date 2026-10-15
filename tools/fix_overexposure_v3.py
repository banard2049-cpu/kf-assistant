from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

src = Path(r"C:\Users\banard\AppData\Local\Temp\httpssteamusercontentaakamaihdnetugc12484020369262714031FA4ED70E2A55BD8A53FB794D874350B1DB8DE486.jpg")
dst = Path(r"D:\files\kf\digestive_track_highlight_fixed_v3.jpg")

im = Image.open(src).convert("RGB")
arr = np.asarray(im, dtype=np.float32) / 255.0
y = 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]

# Moderate global shoulder: recover detail from clipped-looking whites without
# flattening the dark illustrated background.
yg = np.power(np.clip(y, 0.0, 1.0), 1.06)
knee = 0.58
yc = np.where(yg <= knee, yg, knee + (yg - knee) * 0.45)

# White/gray haze is compressed more strongly than colored pixels.
mx, mn = arr.max(axis=2), arr.min(axis=2)
sat = (mx - mn) / np.maximum(mx, 1e-5)
haze = np.clip((y - 0.50) / 0.50, 0.0, 1.0) * np.clip((0.24 - sat) / 0.24, 0.0, 1.0)
yc *= 1.0 - 0.15 * haze

# Bright lettering and grid lines are sharp; retain part of their brightness,
# while broad washed-out patches (low local contrast) stay compressed.
lum8 = Image.fromarray(np.uint8(np.clip(y, 0, 1) * 255), "L")
blur = np.asarray(lum8.filter(ImageFilter.GaussianBlur(radius=2)), dtype=np.float32) / 255.0
edge = np.abs(y - blur)
detail = np.clip((edge - 0.025) / 0.10, 0.0, 1.0) * np.clip((y - 0.58) / 0.42, 0.0, 1.0)
yc = yc * (1.0 - 0.48 * detail) + y * (0.48 * detail)

scale = yc / np.maximum(y, 1e-5)
out = np.clip(arr * scale[..., None], 0.0, 1.0)
out = np.clip((out - 0.5) * 1.025 + 0.5, 0.0, 1.0)

Image.fromarray(np.round(out * 255).astype(np.uint8), "RGB").save(dst, quality=95, optimize=True)
print(dst)
