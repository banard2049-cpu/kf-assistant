package com.kingdomsforlorn.unified.local;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

final class ResourceStore {
    private static final String PUBLIC_PREFIX = "KF_Unified_Assistant/public/";
    private static final String SHORT_PUBLIC_PREFIX = "public/";
    private static final String STORE_NAME = "imported-resources";
    private static final String STAGING_NAME = "imported-resources.tmp";
    private static final String BACKUP_NAME = "imported-resources.old";
    /**
     * Resource packs can be larger than 1 GB, so there is no fixed extracted
     * size limit. Instead, keep a safety margin on the device and fail before
     * the storage fills up.
     */
    private static final long MIN_FREE_SPACE_BYTES = 128L * 1024L * 1024L;
    private static final long SPACE_CHECK_INTERVAL_BYTES = 8L * 1024L * 1024L;
    /**
     * Image packs normally expand to about their compressed size. A much
     * larger ratio usually means a corrupt archive or a zip bomb.
     */
    private static final long MAX_EXPANSION_RATIO = 500L;
    private static final long EXPANSION_SLACK_BYTES = 64L * 1024L * 1024L;
    private static final int MAX_FILES = 10000;

    interface ProgressListener {
        /** Called periodically from the import thread. */
        void onProgress(long extractedBytes, long compressedBytes, long totalBytes, int fileCount);
    }

    private final Context context;
    private final File store;

    ResourceStore(Context context) {
        this.context = context.getApplicationContext();
        File root = this.context.getFilesDir();
        store = new File(root, STORE_NAME);
        File backup = new File(root, BACKUP_NAME);
        if (!store.exists() && backup.exists()) backup.renameTo(store);
        deleteRecursively(new File(root, STAGING_NAME));
    }

    InputStream open(String relativePath) throws IOException {
        if (relativePath == null || relativePath.isEmpty() || relativePath.contains("..")) return null;
        File resource = safeChild(store, relativePath);
        return resource.isFile() ? new FileInputStream(resource) : null;
    }

    ImportResult importZip(Uri source) throws IOException {
        return importZip(source, null);
    }

    ImportResult importZip(Uri source, ProgressListener listener) throws IOException {
        if (source == null) throw new IOException("未选择资源包");
        File root = context.getFilesDir();
        File staging = new File(root, STAGING_NAME);
        File backup = new File(root, BACKUP_NAME);
        deleteRecursively(staging);
        if (!staging.mkdirs() && !staging.isDirectory()) throw new IOException("无法创建资源目录");

        long archiveBytes = sourceSize(source);
        long usableBytes = staging.getUsableSpace();
        if (usableBytes < MIN_FREE_SPACE_BYTES) {
            throw new IOException("设备存储空间不足：导入前请至少保留 " + formatSize(MIN_FREE_SPACE_BYTES) + " 可用空间");
        }
        if (archiveBytes > 0 && usableBytes < archiveBytes + MIN_FREE_SPACE_BYTES) {
            throw new IOException("设备存储空间不足：导入此资源包至少需要 "
                    + formatSize(archiveBytes + MIN_FREE_SPACE_BYTES) + " 可用空间，当前可用 "
                    + formatSize(usableBytes));
        }

        int fileCount = 0;
        long byteCount = 0;
        long nextSpaceCheck = SPACE_CHECK_INTERVAL_BYTES;
        long nextProgressBytes = SPACE_CHECK_INTERVAL_BYTES;
        try {
            InputStream sourceStream = context.getContentResolver().openInputStream(source);
            if (sourceStream == null) throw new IOException("无法读取资源包");
            try (CountingInputStream counted = new CountingInputStream(sourceStream);
                 ZipInputStream zip = new ZipInputStream(counted)) {
                ZipEntry entry;
                byte[] buffer = new byte[64 * 1024];
                while ((entry = zip.getNextEntry()) != null) {
                    if (entry.isDirectory()) continue;
                    String relative = resourceRelativePath(entry.getName());
                    if (relative == null) continue;
                    fileCount++;
                    if (fileCount > MAX_FILES) throw new IOException("资源包文件数量过多（超过 " + MAX_FILES + " 个）");
                    File output = safeChild(staging, relative);
                    File parent = output.getParentFile();
                    if (parent != null && !parent.isDirectory() && !parent.mkdirs()) throw new IOException("无法创建资源目录");
                    try (OutputStream stream = new FileOutputStream(output)) {
                        int read;
                        while ((read = zip.read(buffer)) != -1) {
                            byteCount += read;
                            if (byteCount >= nextSpaceCheck) {
                                ensureSpace(staging, byteCount, counted.count);
                                nextSpaceCheck = byteCount + SPACE_CHECK_INTERVAL_BYTES;
                            }
                            if (listener != null && byteCount >= nextProgressBytes) {
                                listener.onProgress(byteCount, counted.count, archiveBytes, fileCount);
                                nextProgressBytes = byteCount + SPACE_CHECK_INTERVAL_BYTES;
                            }
                            try {
                                stream.write(buffer, 0, read);
                            } catch (IOException writeError) {
                                if (staging.getUsableSpace() < MIN_FREE_SPACE_BYTES) {
                                    throw new IOException("设备存储空间不足，导入未完成", writeError);
                                }
                                throw writeError;
                            }
                        }
                    }
                    if (listener != null && fileCount % 200 == 0) {
                        listener.onProgress(byteCount, counted.count, archiveBytes, fileCount);
                        nextProgressBytes = byteCount + SPACE_CHECK_INTERVAL_BYTES;
                    }
                }
                if (listener != null) listener.onProgress(byteCount, counted.count, archiveBytes, fileCount);
            }
            if (fileCount == 0) throw new IOException("资源包中没有可导入的图片");

            deleteRecursively(backup);
            if (store.exists() && !store.renameTo(backup)) throw new IOException("无法替换旧资源");
            if (!staging.renameTo(store)) {
                if (backup.exists()) backup.renameTo(store);
                throw new IOException("无法保存新资源");
            }
            deleteRecursively(backup);
            return new ImportResult(fileCount, byteCount);
        } catch (IOException | RuntimeException error) {
            deleteRecursively(staging);
            throw error;
        }
    }

    private static void ensureSpace(File directory, long extractedBytes, long compressedBytes) throws IOException {
        if (compressedBytes > 0
                && extractedBytes > compressedBytes * MAX_EXPANSION_RATIO + EXPANSION_SLACK_BYTES) {
            throw new IOException("资源包解压体积异常，请确认压缩包没有损坏");
        }
        long usable = directory.getUsableSpace();
        if (usable < MIN_FREE_SPACE_BYTES) {
            throw new IOException("设备存储空间不足：已解压 " + formatSize(extractedBytes)
                    + "，导入需要至少保留 " + formatSize(MIN_FREE_SPACE_BYTES) + " 可用空间");
        }
    }

    private long sourceSize(Uri source) {
        try (AssetFileDescriptor descriptor = context.getContentResolver().openAssetFileDescriptor(source, "r")) {
            if (descriptor == null) return -1;
            long length = descriptor.getLength();
            return length > 0 ? length : -1;
        } catch (Exception ignored) {
            return -1;
        }
    }

    static String formatSize(long bytes) {
        if (bytes >= 1024L * 1024L * 1024L) {
            return String.format(Locale.ROOT, "%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0));
        }
        if (bytes >= 1024L * 1024L) {
            return String.format(Locale.ROOT, "%.1f MB", bytes / (1024.0 * 1024.0));
        }
        return String.format(Locale.ROOT, "%.0f KB", Math.max(1.0, bytes / 1024.0));
    }

    private String resourceRelativePath(String entryName) {
        if (entryName == null) return null;
        String path = entryName.replace('\\', '/');
        while (path.startsWith("/")) path = path.substring(1);
        if (path.startsWith(PUBLIC_PREFIX)) path = path.substring(PUBLIC_PREFIX.length());
        else if (path.startsWith(SHORT_PUBLIC_PREFIX)) path = path.substring(SHORT_PUBLIC_PREFIX.length());
        else return null;
        if (path.isEmpty() || path.contains("..") || path.contains(":")) return null;
        String lower = path.toLowerCase(Locale.ROOT);
        return lower.matches(".*\\.(png|jpg|jpeg|jfif|gif|webp|avif|bmp|ico|svg|tif|tiff|heic|heif|psd|xcf)$") ? path : null;
    }

    private File safeChild(File root, String relativePath) throws IOException {
        File child = new File(root, relativePath);
        String rootPath = root.getCanonicalPath() + File.separator;
        if (!child.getCanonicalPath().startsWith(rootPath)) throw new IOException("资源包包含非法路径");
        return child;
    }

    private static void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursively(child);
        }
        // Paths passed here are fixed children of the app-private files directory.
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }

    private static final class CountingInputStream extends FilterInputStream {
        long count;

        CountingInputStream(InputStream input) {
            super(input);
        }

        @Override
        public int read() throws IOException {
            int value = super.read();
            if (value != -1) count++;
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int read = super.read(buffer, offset, length);
            if (read > 0) count += read;
            return read;
        }

        @Override
        public long skip(long byteCount) throws IOException {
            long skipped = super.skip(byteCount);
            if (skipped > 0) count += skipped;
            return skipped;
        }
    }

    static final class ImportResult {
        final int fileCount;
        final long byteCount;

        ImportResult(int fileCount, long byteCount) {
            this.fileCount = fileCount;
            this.byteCount = byteCount;
        }
    }
}
