package sk.kubo.stavebnyarchiv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Online archive launcher: authentication and file handling stay in the browser. */
public final class MainActivity extends Activity {
    private static final String ARCHIVE_URL = "https://stavebny-archiv.jakub-novak421.chatgpt.site/";
    private static final int ORANGE = 0xFFEC5A16;
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER);
        page.setBackgroundColor(0xFFF7F8F5);
        page.setPadding(dp(28),dp(32),dp(28),dp(32));
        page.setOnApplyWindowInsetsListener((view,insets)->{
            if(android.os.Build.VERSION.SDK_INT>=30){
                android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());
                view.setPadding(dp(28)+bars.left,dp(32)+bars.top,dp(28)+bars.right,dp(32)+bars.bottom);
            } else {
                view.setPadding(dp(28)+insets.getSystemWindowInsetLeft(),dp(32)+insets.getSystemWindowInsetTop(),dp(28)+insets.getSystemWindowInsetRight(),dp(32)+insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        ImageView logo=new ImageView(this);
        logo.setImageResource(R.drawable.ic_archive);
        logo.setContentDescription("Zakládání staveb");
        LinearLayout.LayoutParams logoParams=new LinearLayout.LayoutParams(dp(92),dp(100));
        logoParams.bottomMargin=dp(28);
        page.addView(logo,logoParams);
        TextView heading=text("Stavebný archív",28,0xFF222A29);
        heading.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        page.addView(heading);
        TextView sub=text("Dokumenty stavieb na jednom mieste",16,0xFF747B78);
        LinearLayout.LayoutParams subParams=new LinearLayout.LayoutParams(-1,-2);
        subParams.topMargin=dp(14);subParams.bottomMargin=dp(28);
        page.addView(sub,subParams);
        Button open=new Button(this);
        open.setText("Otvoriť archív");
        open.setTextColor(Color.WHITE);open.setAllCaps(false);open.setTextSize(16);
        GradientDrawable background=new GradientDrawable();background.setColor(ORANGE);background.setCornerRadius(dp(10));
        open.setBackground(background);
        open.setOnClickListener(v->openArchive());
        page.addView(open,new LinearLayout.LayoutParams(-1,dp(56)));
        TextView note=text("Archív sa otvorí v prehliadači telefónu.\nPotrebuje internet a prihlásenie cez ChatGPT.",13,0xFF747B78);
        LinearLayout.LayoutParams noteParams=new LinearLayout.LayoutParams(-1,-2);noteParams.topMargin=dp(22);
        page.addView(note,noteParams);
        setContentView(page);
    }
    private TextView text(String value,int size,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setGravity(Gravity.CENTER);t.setLineSpacing(dp(3),1);return t;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private void openArchive(){
        try {
            Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(ARCHIVE_URL));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch(ActivityNotFoundException e){
            new AlertDialog.Builder(this).setTitle("Chýba prehliadač").setMessage("Nainštaluj alebo zapni internetový prehliadač a skús to znova.").setPositiveButton("OK",null).show();
        }
    }
}
