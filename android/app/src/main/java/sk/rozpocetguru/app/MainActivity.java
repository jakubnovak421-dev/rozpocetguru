package sk.rozpocetguru.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final String START_URL = "https://jakubnovak421-dev.github.io/rozpocetguru/";
    private static final String ALLOWED_HOST = "jakubnovak421-dev.github.io";
    private static final int FILE_CHOOSER_REQUEST = 401;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    private static final String DOWNLOAD_HOOK =
            "(function(){"
          + "if(window.__rgAndroidDownloadHook)return;"
          + "window.__rgAndroidDownloadHook=true;"
          + "window.__RG_ANDROID_APP__='1.1';"
          + "document.documentElement.classList.add('rg-android-app');"
          + "var oldClick=HTMLAnchorElement.prototype.click;"
          + "HTMLAnchorElement.prototype.click=function(){"
          + " try{"
          + "  if(this.download&&this.href&&this.href.indexOf('blob:')===0){"
          + "   var a=this;"
          + "   fetch(a.href).then(function(r){return r.blob();}).then(function(b){"
          + "    var fr=new FileReader();"
          + "    fr.onloadend=function(){"
          + "      var s=String(fr.result||'');"
          + "      var p=s.indexOf(',');"
          + "      var data=p>=0?s.substring(p+1):s;"
          + "      AndroidBridge.saveBase64(data,a.download||'rozpocetguru.json',b.type||'application/json');"
          + "    };"
          + "    fr.readAsDataURL(b);"
          + "   });"
          + "   return;"
          + "  }"
          + " }catch(e){}"
          + " return oldClick.apply(this,arguments);"
          + "};"
          + "})();";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(7, 17, 31));
        getWindow().setNavigationBarColor(Color.rgb(7, 17, 31));
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                        0,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                );
            }
        }

        // Android 15/16 enforce edge-to-edge for modern targets.  Padding the root
        // container (not WebView itself) keeps the web UI clear of status/navigation bars.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7, 17, 31));
        root.setFitsSystemWindows(false);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 17, 31));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                v.setPadding(
                        insets.getSystemWindowInsetLeft(),
                        insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(),
                        insets.getSystemWindowInsetBottom()
                );
            }
            return insets;
        });
        setContentView(root);
        root.requestApplyInsets();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString() + " RozpocetGuruAndroid/1.1");

        CookieManager.getInstance().setAcceptCookie(true);
        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && ALLOWED_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if ("https".equalsIgnoreCase(uri.getScheme()) && ALLOWED_HOST.equalsIgnoreCase(uri.getHost())) {
                    view.evaluateJavascript(DOWNLOAD_HOOK, null);
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                Toast.makeText(MainActivity.this, "Bezpečné HTTPS pripojenie zlyhalo.", Toast.LENGTH_LONG).show();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showOfflinePage();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams fileChooserParams) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "application/json",
                        "text/json",
                        "text/plain",
                        "application/octet-stream"
                });

                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Výber zálohy sa nepodarilo otvoriť.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setTitle(fileName);
                    request.setMimeType(mimeType);
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "RozpocetGuru/" + fileName);
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null) request.addRequestHeader("Cookie", cookies);
                    if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);
                    ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
                    Toast.makeText(this, "Sťahujem do Stiahnuté/RozpocetGuru", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(this, "Súbor sa nepodarilo stiahnuť.", Toast.LENGTH_LONG).show();
                }
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void openExternal(Uri uri) {
        if (uri == null) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Odkaz sa nepodarilo otvoriť.", Toast.LENGTH_SHORT).show();
        }
    }

    private void showOfflinePage() {
        String html =
                "<!doctype html><html lang='sk'><meta name='viewport' content='width=device-width,initial-scale=1'>"
              + "<body style='margin:0;background:#07111f;color:#f5f8fc;font-family:sans-serif;display:grid;place-items:center;min-height:100vh'>"
              + "<div style='max-width:420px;padding:28px;text-align:center'>"
              + "<div style='font-size:42px'>✦</div><h1>RozpočetGuru</h1>"
              + "<p style='color:#8797ad'>Nepodarilo sa načítať aplikáciu. Skontroluj internetové pripojenie.</p>"
              + "<button onclick=\"location.href='" + START_URL + "'\" style='border:0;border-radius:14px;padding:13px 18px;background:#70e3b0;color:#07140f;font-weight:700'>Skúsiť znova</button>"
              + "</div></body></html>";
        webView.loadDataWithBaseURL(START_URL, html, "text/html", "UTF-8", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                    Uri selected = data.getData();
                    try {
                        getContentResolver().takePersistableUriPermission(
                                selected,
                                data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                        );
                    } catch (Exception ignored) {
                        // Temporary permission from the picker is enough for the current import.
                    }
                    results = new Uri[]{selected};
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    public static class AndroidBridge {
        private final Context context;

        AndroidBridge(Context context) {
            this.context = context.getApplicationContext();
        }

        @JavascriptInterface
        public void saveBase64(String base64, String fileName, String mimeType) {
            new Thread(() -> {
                try {
                    String clean = sanitizeFileName(fileName);
                    byte[] bytes = Base64.decode(base64, Base64.DEFAULT);

                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, clean);
                    values.put(MediaStore.Downloads.MIME_TYPE,
                            (mimeType == null || mimeType.isEmpty()) ? "application/octet-stream" : mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS + "/RozpocetGuru");

                    Uri uri = context.getContentResolver().insert(
                            MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("MediaStore insert failed");

                    try (OutputStream out = context.getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new IllegalStateException("Output stream failed");
                        out.write(bytes);
                    }

                    Activity a = MainActivity.currentActivity();
                    if (a != null) a.runOnUiThread(() ->
                            Toast.makeText(context,
                                    "Záloha uložená: Stiahnuté/RozpocetGuru/" + clean,
                                    Toast.LENGTH_LONG).show());
                } catch (Exception e) {
                    Activity a = MainActivity.currentActivity();
                    if (a != null) a.runOnUiThread(() ->
                            Toast.makeText(context, "Export zálohy sa nepodarilo uložiť.", Toast.LENGTH_LONG).show());
                }
            }).start();
        }

        private static String sanitizeFileName(String name) {
            String clean = (name == null || name.trim().isEmpty()) ? "rozpocetguru.json" : name.trim();
            clean = clean.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
            if (clean.length() > 120) clean = clean.substring(clean.length() - 120);
            return clean;
        }
    }

    private static Activity activityRef;

    @Override
    protected void onResume() {
        super.onResume();
        activityRef = this;
    }

    @Override
    protected void onPause() {
        if (activityRef == this) activityRef = null;
        super.onPause();
    }

    static Activity currentActivity() {
        return activityRef;
    }
}
