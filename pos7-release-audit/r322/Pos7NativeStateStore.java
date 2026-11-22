package com.sokkarzeyedeh.pos7;

import android.content.Context;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * R322: durable private Android backing for POS7_TRIAL188_CLEAN only.
 * This is NOT a WebView localStorage quota override. No shared preferences,
 * Supabase, stock synchronization or invoice semantics are changed.
 *
 * AtomicFile rolls back incomplete writes and never replaces a good file
 * with a partial payload after a process crash or disk-space failure.
 */
final class Pos7NativeStateStore {
    private static final int MAX_BYTES = 128 * 1024 * 1024;
    private final AtomicFile disk;

    Pos7NativeStateStore(Context context) throws IOException {
        File dir = new File(context.getFilesDir(), "pos7_native_state_r322");
        if (!dir.isDirectory() && !dir.mkdirs()) {
            throw new IOException("Cannot create POS7 private state directory");
        }
        disk = new AtomicFile(new File(dir, "pos7_main_state.json"));
    }

    synchronized String read() throws IOException {
        try {
            byte[] bytes = disk.readFully();
            if (bytes.length == 0 || bytes.length > MAX_BYTES) {
                throw new IOException("Invalid POS7 state size");
            }
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (FileNotFoundException notInitialized) {
            // No file yet: JS migrates from the original WebView localStorage.
            return null;
        }
    }

    synchronized boolean write(String raw) {
        if (raw == null || raw.length() < 2 || raw.charAt(0) != '{' || raw.length() > MAX_BYTES) {
            return false;
        }
        byte[] bytes = raw.getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_BYTES) return false;
        FileOutputStream out = null;
        try {
            out = disk.startWrite();
            out.write(bytes);
            disk.finishWrite(out);
            return true;
        } catch (IOException | RuntimeException failure) {
            if (out != null) disk.failWrite(out);
            android.util.Log.e("POS7-R322", "Native state save failed; previous state retained", failure);
            return false;
        }
    }

    synchronized long sizeBytes() {
        try {
            String text = read();
            return text == null ? 0 : text.getBytes(StandardCharsets.UTF_8).length;
        } catch (Exception e) {
            return -1;
        }
    }

    long freeBytes() {
        return disk.getBaseFile().getParentFile().getUsableSpace();
    }
}
