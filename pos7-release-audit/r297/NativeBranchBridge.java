package com.sokkarzeyedeh.pos7;
import android.content.Context;
import android.webkit.JavascriptInterface;
/** R297 diagnostic gate. No method here may enroll or authorize a device. */
public final class NativeBranchBridge {
 private final Context context;
 public NativeBranchBridge(Context c){context=c.getApplicationContext();}
 @JavascriptInterface public boolean canReadPreflight(String branch,String project){
  android.content.SharedPreferences prefs=context.getSharedPreferences("pos7_native_identity_v1",0);
  if(!prefs.getBoolean("server_verified_identity",false))return false;
  return NativeBranchPolicy.mayReadForPreflight(prefs.getString("verified_branch",""),branch,project);
 }
 @JavascriptInterface public boolean canPublish(){return false;}
}
