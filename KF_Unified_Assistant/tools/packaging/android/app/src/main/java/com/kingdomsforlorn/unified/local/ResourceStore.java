package com.kingdomsforlorn.unified.local;

import android.content.Context;
import android.net.Uri;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
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
    private static final long MAX_EXTRACTED_BYTES = 1024L * 1024L * 1024L;
    private static final int MAX_FILES = 10000;

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
        if (source == null) throw new IOException("未选择资源包");
        File root = context.getFilesDir();
        File staging = new File(root, STAGING_NAME);
        File backup = new File(root, BACKUP_NAME);
        deleteRecursively(staging);
        if (!staging.mkdirs() && !staging.isDirectory()) throw new IOException("无法创建资源目录");

        int fileCount = 0;
        long byteCount = 0;
        try {
            InputStream sourceStream = context.getContentResolver().openInputStream(source);
            if (sourceStream == null) throw new IOException("无法读取资源包");
            try (InputStream input = sourceStream; ZipInputStream zip = new ZipInputStream(input)) {
                ZipEntry entry;
                byte[] buffer = new byte[8192];
                while ((entry = zip.getNextEntry()) != null) {
                    if (entry.isDirectory()) continue;
                    String relative = resourceRelativePath(entry.getName());
                    if (relative == null) continue;
                    fileCount++;
                    if (fileCount > MAX_FILES) throw new IOException("资源包文件数量过多");
                    File output = safeChild(staging, relative);
                    File parent = output.getParentFile();
                    if (parent != null && !parent.isDirectory() && !parent.mkdirs()) throw new IOException("无法创建资源目录");
                    try (OutputStream stream = new FileOutputStream(output)) {
                        int read;
                        while ((read = zip.read(buffer)) != -1) {
                            byteCount += read;
                            if (byteCount > MAX_EXTRACTED_BYTES) throw new IOException("资源包解压后超过 1 GB");
                            stream.write(buffer, 0, read);
                        }
                    }
                }
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

    static final class ImportResult {
        final int fileCount;
        final long byteCount;

        ImportResult(int fileCount, long byteCount) {
            this.fileCount = fileCount;
            this.byteCount = byteCount;
        }
    }
}
