        @JavascriptInterface public boolean pos387SaveRestoreSafety(String backup) {
            if (!pos322TrustedPage || backup == null || backup.length() > 128 * 1024 * 1024) return false;
            byte[] bytes = backup.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (bytes.length == 0 || bytes.length > 128 * 1024 * 1024) return false;
            java.io.File directory = new java.io.File(context.getFilesDir(), "pos7_native_state_tab2_r345");
            java.io.File file = new java.io.File(directory, "before-r387-" + java.util.UUID.randomUUID() + ".json");
            android.util.AtomicFile safety = new android.util.AtomicFile(file);
            java.io.FileOutputStream output = null;
            try {
                output = safety.startWrite();
                output.write(bytes);
                safety.finishWrite(output);
                output = null;
                return file.length() == bytes.length;
            } catch (java.io.IOException | RuntimeException failure) {
                if (output != null) safety.failWrite(output);
                return false;
            }
        }

        @JavascriptInterface public boolean pos387ExportRestoreSafety() {
            if (!pos322TrustedPage) return false;
            java.io.File directory = new java.io.File(context.getFilesDir(), "pos7_native_state_tab2_r345");
            java.io.File[] copies = directory.listFiles((dir, name) -> name.startsWith("before-r387-") && name.endsWith(".json"));
            if (copies == null || copies.length == 0) return false;
            java.util.Arrays.sort(copies, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            try {
                byte[] bytes = new android.util.AtomicFile(copies[0]).readFully();
                saveBackupJson("POS7_Tab2_before_R387_restore.json", new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
                return true;
            } catch (java.io.IOException | RuntimeException failure) {
                return false;
            }
        }

