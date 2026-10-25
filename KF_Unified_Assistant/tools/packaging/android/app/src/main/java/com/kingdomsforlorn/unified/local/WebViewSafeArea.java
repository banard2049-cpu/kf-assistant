package com.kingdomsforlorn.unified.local;

import android.app.Activity;
import android.graphics.Insets;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;

/** Keeps the WebView viewport, including fixed HTML navigation, inside usable screen bounds. */
final class WebViewSafeArea {
    private WebViewSafeArea() {}

    static FrameLayout wrap(Activity activity, View content) {
        FrameLayout container = new FrameLayout(activity);
        container.setBackgroundColor(0xff101211);
        container.addView(content, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 15 enforces edge-to-edge for target SDK 35. Handle it explicitly
            // on API 30+ so the same layout works on both sides of that change.
            activity.getWindow().setDecorFitsSystemWindows(false);
            container.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                // Pad the parent, not WebView: fixed-position HTML uses the viewport
                // and can still overlap system bars when only WebView is padded.
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        } else {
            // Older Android versions retain decor fitting and resize for the IME.
            container.setFitsSystemWindows(true);
        }
        return container;
    }
}
